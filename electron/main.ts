import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { exec } from 'node:child_process';
import { PenTestPalService, validateSecurityRequest } from './pentestpal.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureManagedLocalLlm, getManagedLocalLlmState, stopManagedLocalLlm } from './localLlmRuntime.js';
import { fetchServerProps, fitMessagesToContext, QwenError, streamChatCompletion, type QwenErrorCode } from './qwenClient.js';
import { applyDotEnv, getQwenConfig, toClientConfig } from './qwenConfig.js';
import { formatDoctorReport, runQwenDoctor } from './qwenDoctor.js';
import { OfwConnection } from './ofw.js';
import { ANALYSIS_TASKS, buildChatContext, buildGroundedPrompt, groundingBudget, TASK_LABELS, type AnalysisTask } from './ofw-grounding.js';
import { assertOfwDestination, containsOfwRecords, isSafeExternalUrl, isTrustedSenderUrl, isValidRequestId, sanitizeChatMessages, type ChatMessage } from './ipcGuards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const allowCommands = process.env.AGENT_FORCE_ALLOW_COMMANDS === 'true';
let ofwConnection: OfwConnection;
let securityService: PenTestPalService | undefined;
const appFileUrl = pathToFileURL(path.join(__dirname, '../../dist/index.html')).href;
const devServerUrl = isDev ? process.env.VITE_DEV_SERVER_URL : undefined;

/** Accept IPC only from the app's own page (see ipcGuards.isTrustedSenderUrl). */
function trusted(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  const ok = isTrustedSenderUrl(event.senderFrame?.url, appFileUrl, devServerUrl);
  if (!ok) console.warn(`Ignored IPC from untrusted frame: ${event.senderFrame?.url ?? 'unknown'}`);
  return ok;
}
const UNTRUSTED = { ok: false, error: 'Request refused: it did not come from the Agent FORCE window.' };

type ActiveQwenStream = {
  controller: AbortController;
  senderId: number;
};

const activeQwenStreams = new Map<string, ActiveQwenStream>();

// Settings and credentials come from a local .env (gitignored); real
// environment variables win. Shared with scripts/qwen-doctor.mjs.
const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) applyDotEnv(readFileSync(envPath, 'utf8'));

function assertSafeLlmBaseUrl(baseUrl: string) {
  const parsed = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('LLM_BASE_URL must use http or https.');
  }
}

function getLlmHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

async function qwenFetch(
  pathname: string,
  init: RequestInit = {},
  options: { controller?: AbortController; connectTimeoutMs?: number } = {}
) {
  const config = getQwenConfig();
  assertSafeLlmBaseUrl(config.baseUrl);
  const controller = options.controller ?? new AbortController();
  const connectTimeoutMs = options.connectTimeoutMs ?? config.timeoutMs;
  let connectTimedOut = false;
  const timeout = setTimeout(() => {
    connectTimedOut = true;
    controller.abort();
  }, connectTimeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/${pathname.replace(/^\/+/, '')}`, {
      ...init,
      headers: {
        ...getLlmHeaders(config.apiKey),
        ...(init.headers ?? {})
      },
      signal: controller.signal
    });

    if (!response.ok) {
      let body = '';
      try {
        body = await response.text();
      } catch (error) {
        body = `Response body unavailable: ${error instanceof Error ? error.message : 'unknown read error'}`;
      }
      if (response.status === 401) {
        throw new Error('AUTH_FAILED: The inference provider rejected the configured credential.');
      }
      throw new Error(`LLM endpoint returned HTTP ${response.status}${body ? `: ${body}` : ''}`);
    }

    return response;
  } catch (error) {
    if (connectTimedOut) {
      throw new Error(`SERVER_UNAVAILABLE: Connection timed out after ${connectTimeoutMs / 1000}s.`);
    }
    if (controller.signal.aborted) {
      throw new Error('CANCELLED: The inference request was cancelled.');
    }
    if (error instanceof Error) {
      if (error.message.startsWith('AUTH_FAILED:') || error.message.startsWith('LLM endpoint returned HTTP')) throw error;
      throw new Error(`LLM endpoint failed at ${config.baseUrl}: ${error.message}`);
    }
    throw new Error(`LLM endpoint failed at ${config.baseUrl}.`);
  } finally {
    clearTimeout(timeout);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    title: 'Agent FORCE Dashboard',
    backgroundColor: '#030611',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
    console.error(`Renderer failed to load ${validatedUrl}: ${errorCode} ${errorDescription}`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`Renderer process exited: ${details.reason} (${details.exitCode})`);
  });
  // The window only ever shows the app. Links open in the system browser;
  // any other navigation or new window is refused.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedSenderUrl(url, appFileUrl, devServerUrl)) event.preventDefault();
  });
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

ipcMain.handle('agent-force:open-external', async (event, target: unknown) => {
  if (!trusted(event)) return UNTRUSTED;
  if (!isSafeExternalUrl(target)) {
    return { ok: false, error: 'Only http, https, and mailto links are allowed.' };
  }

  await shell.openExternal(target);
  return { ok: true };
});

ipcMain.handle('agent-force:reveal-path', async (event, target: unknown) => {
  if (!trusted(event)) return UNTRUSTED;
  if (typeof target !== 'string' || target.trim().length < 2 || target.length > 1024) {
    return { ok: false, error: 'No local path configured for this project.' };
  }

  if (!existsSync(target)) {
    return { ok: false, error: 'Configured local path does not exist.' };
  }

  shell.showItemInFolder(target);
  return { ok: true };
});

ipcMain.handle('agent-force:run-command', async (event, command: unknown) => {
  if (!trusted(event)) return UNTRUSTED;
  if (!allowCommands) {
    return {
      ok: false,
      error: 'Command launching is disabled. Set AGENT_FORCE_ALLOW_COMMANDS=true to enable it.'
    };
  }

  if (typeof command !== 'string' || !command.trim() || command.length > 500) {
    return { ok: false, error: 'Command is empty or too long.' };
  }

  return new Promise((resolve) => {
    exec(command, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: stderr || error.message });
        return;
      }

      resolve({ ok: true, output: stdout || stderr || 'Command completed.' });
    });
  });
});

ipcMain.handle('agent-force:get-platform', async (event) => (trusted(event) ? process.platform : 'unknown'));

ipcMain.handle('agent-force:pentestpal', async (event, input: unknown) => {
  if (!trusted(event)) return UNTRUSTED;
  try {
    const request = validateSecurityRequest(input);
    const service = securityService ??= new PenTestPalService(path.join(app.getPath('userData'), 'pentestpal'));
    let data;
    switch (request.action) {
      case 'plan': data = await service.prepare(request.scopeText); break;
      case 'demo': data = service.start(request.fixed ? 'fixed-demo' : 'demo'); break;
      case 'run': data = service.start('assessment', request.planId, request.authorized, request.previousId); break;
      case 'stop': data = service.stop(request.runId); break;
      case 'reveal': shell.showItemInFolder(service.reveal(request.runId)); data = service.snapshot(); break;
      default: data = service.snapshot();
    }
    return { ok: true, data };
  } catch (error) {
    // Only controlled service messages reach the renderer; no native exception/path/credential dump.
    const message = error instanceof Error ? error.message : '';
    const known = /^(Invalid request\.|Report exceeds|Unsupported |A plan or run|Set PENTESTPAL_ROOT|Plan rejected\.|Review a current plan|Select a prior report|This run is no longer active|Unknown run\.)/;
    return { ok: false, error: known.test(message) ? message : 'PenTestPal could not complete this action. Check local configuration and writable storage.' };
  }
});

ipcMain.handle('agent-force:qwen-config', async (event) => {
  if (!trusted(event)) return UNTRUSTED;
  const config = getQwenConfig();
  return {
    ok: true,
    baseUrl: config.baseUrl,
    modelName: config.modelName,
    hasApiKey: Boolean(config.apiKey),
    timeoutMs: config.timeoutMs,
    runtime: getManagedLocalLlmState(config.baseUrl)
  };
});

ipcMain.handle('agent-force:qwen-health', async (event) => {
  if (!trusted(event)) return UNTRUSTED;
  try {
    await qwenFetch('models', { method: 'GET' });
    const config = getQwenConfig();
    return { ok: true, baseUrl: config.baseUrl, modelName: config.modelName };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Qwen health check failed.' };
  }
});

// Full diagnosis with measurements; the renderer shows it and can copy it.
ipcMain.handle('agent-force:qwen-doctor', async (event, appBuild?: unknown) => {
  if (!trusted(event)) return UNTRUSTED;
  const config = getQwenConfig();
  const report = await runQwenDoctor({
    client: toClientConfig(config),
    runtime: getManagedLocalLlmState(config.baseUrl),
    ensureRuntime: () => ensureManagedLocalLlm(config)
  });
  return { ...report, text: formatDoctorReport(report, typeof appBuild === 'string' ? appBuild.slice(0, 120) : undefined) };
});

/** llama.cpp's context size, cached briefly (it only changes when the server restarts). */
let contextSizeCache: { baseUrl: string; at: number; nCtx?: number } | null = null;
async function contextSize(): Promise<number | undefined> {
  const config = getQwenConfig();
  if (contextSizeCache && contextSizeCache.baseUrl === config.baseUrl && Date.now() - contextSizeCache.at < 60_000) return contextSizeCache.nCtx;
  const props = await fetchServerProps(config);
  // Remember only a real answer; a failed lookup is retried on the next request.
  contextSizeCache = props?.nCtx ? { baseUrl: config.baseUrl, at: Date.now(), nCtx: props.nCtx } : null;
  return props?.nCtx;
}

/**
 * Stream a chat completion to the renderer on `agent-force:qwen-stream:<id>`.
 * Shared by the Qwen chat panel and grounded OFW analysis. Events:
 * phase (queued | prompt-evaluating) · progress · notice · token · stats ·
 * truncated · done | error{code}.
 */
/**
 * Register a cancellable request: `agent-force:qwen-cancel` and a closed
 * window both abort it. Returns the controller and a release function.
 */
function registerStream(sender: Electron.WebContents, requestId: string) {
  const controller = new AbortController();
  const stream: ActiveQwenStream = { controller, senderId: sender.id };
  activeQwenStreams.get(requestId)?.controller.abort();
  activeQwenStreams.set(requestId, stream);
  // A window that closes mid-answer must free llama.cpp's only slot.
  const onGone = () => controller.abort();
  sender.once('destroyed', onGone);
  return {
    controller,
    release: () => {
      sender.removeListener('destroyed', onGone);
      if (activeQwenStreams.get(requestId) === stream) activeQwenStreams.delete(requestId);
    }
  };
}

async function streamQwenToSender(sender: Electron.WebContents, requestId: string, messages: ChatMessage[], options: { maxTokens?: number; controller?: AbortController } = {}) {
  const channel = `agent-force:qwen-stream:${requestId}`;
  const send = (payload: Record<string, unknown>) => { if (!sender.isDestroyed()) sender.send(channel, payload); };
  const owned = options.controller ? null : registerStream(sender, requestId);
  const controller = options.controller ?? owned!.controller;
  const config = getQwenConfig();
  const maxTokens = options.maxTokens ?? config.maxOutputTokens;

  try {
    assertSafeLlmBaseUrl(config.baseUrl);
    // Defence in depth: whatever the renderer did, OFW excerpts only go to a local model.
    if (containsOfwRecords(messages)) assertOfwDestination(config.baseUrl, process.env.OFW_ALLOW_REMOTE_LLM === 'true');
    try {
      await ensureManagedLocalLlm(config);
    } catch (error) {
      throw new QwenError('RUNTIME_FAILED', error instanceof Error ? error.message : 'The local model runtime did not start.');
    }
    if (controller.signal.aborted) throw new QwenError('CANCELLED', 'The inference request was cancelled.');

    // Never send a prompt the server will reject: fit it to the real context
    // window, dropping the oldest conversation first.
    let outgoing = messages;
    const nCtx = await contextSize();
    if (nCtx) {
      const fitted = fitMessagesToContext(messages, nCtx - maxTokens - 64);
      outgoing = fitted.messages;
      if (fitted.droppedMessages || fitted.trimmedChars) {
        send({
          type: 'notice',
          message: fitted.droppedMessages
            ? `Left out the ${fitted.droppedMessages} oldest message${fitted.droppedMessages === 1 ? '' : 's'} of this conversation to fit the model's ${nCtx.toLocaleString()}-token context.`
            : `Shortened the request by ${fitted.trimmedChars.toLocaleString()} characters to fit the model's ${nCtx.toLocaleString()}-token context.`
        });
      }
    }

    await streamChatCompletion(toClientConfig(config), outgoing, {
      signal: controller.signal,
      maxTokens,
      onEvent: (event) => send(event as unknown as Record<string, unknown>)
    });
    send({ type: 'done' });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Qwen stream request failed.';
    const code: QwenErrorCode | 'REMOTE_MODEL_BLOCKED' = error instanceof QwenError ? error.code : message.startsWith('REMOTE_MODEL_BLOCKED:') ? 'REMOTE_MODEL_BLOCKED' : 'HTTP_ERROR';
    send({ type: 'error', code, error: message });
    return { ok: false, error: message };
  } finally {
    owned?.release();
  }
}

ipcMain.handle('agent-force:qwen-stream-chat', async (event, requestId: unknown, messages: unknown) => {
  if (!trusted(event)) return UNTRUSTED;
  if (!isValidRequestId(requestId)) return { ok: false, error: 'Invalid request id.' };
  let checked: ChatMessage[];
  try {
    checked = sanitizeChatMessages(messages);
  } catch (error) {
    const message = `HTTP_ERROR: ${error instanceof Error ? error.message : 'Invalid chat request.'}`;
    event.sender.send(`agent-force:qwen-stream:${requestId}`, { type: 'error', code: 'HTTP_ERROR', error: message });
    return { ok: false, error: message };
  }
  return streamQwenToSender(event.sender, requestId, checked);
});

function getOfwConnection() {
  if (!ofwConnection) {
    ofwConnection = new OfwConnection(process.env.AGENT_FORCE_OFW_CONFIG || path.resolve(process.cwd(), 'ofw.local.json'));
  }
  return ofwConnection;
}

/**
 * OFW records are legal records: they may only be sent to a model running on
 * this machine. OFW_ALLOW_REMOTE_LLM=true is the explicit, documented opt-out.
 */
function assertLocalModelForOfw() {
  assertOfwDestination(getQwenConfig().baseUrl, process.env.OFW_ALLOW_REMOTE_LLM === 'true');
}

type AnalyzeRequest = { task?: unknown; query?: unknown; folderId?: unknown; since?: unknown; until?: unknown };

// Grounded analysis: retrieve the relevant messages, then have the local model
// answer / summarize / build a timeline / extract commitments from those
// excerpts only, citing message numbers. Events: sources → phase → token… → done | error.
ipcMain.handle('agent-force:ofw-analyze', async (event, requestId: unknown, request: AnalyzeRequest) => {
  if (!trusted(event)) return UNTRUSTED;
  if (!isValidRequestId(requestId)) return { ok: false, error: 'Invalid request id.' };
  const channel = `agent-force:qwen-stream:${requestId}`;
  const send = (payload: Record<string, unknown>) => { if (!event.sender.isDestroyed()) event.sender.send(channel, payload); };
  // Registered before retrieval, so Stop works while messages are still being searched.
  const { controller, release } = registerStream(event.sender, requestId);
  const cancelled = () => new QwenError('CANCELLED', 'The analysis was cancelled.');
  try {
    const task = (ANALYSIS_TASKS as readonly unknown[]).includes(request?.task) ? request.task as AnalysisTask : 'answer';
    const question = typeof request?.query === 'string' ? request.query.trim().slice(0, 500) : '';
    if (task === 'answer' && !question) throw new Error('Type a question to answer.');
    assertLocalModelForOfw();
    send({ type: 'phase', phase: 'retrieving' });
    const config = getQwenConfig();
    const maxTokens = task === 'answer' ? config.maxOutputTokens : Math.max(config.maxOutputTokens, 768);
    const nCtx = await contextSize();
    const envBudget = groundingBudget(process.env);
    // Leave room for the instructions (~600 tokens) and the answer; 3.2 chars/token is conservative.
    const budget = nCtx
      ? { ...envBudget, maxChars: Math.max(1500, Math.min(envBudget.maxChars, Math.floor((nCtx - maxTokens - 900) * 3.2))) }
      : envBudget;
    const payload = await getOfwConnection().request('nlsearch', {
      query: question || 'messages',
      mode: 'natural',
      folderId: request?.folderId,
      since: request?.since || undefined,
      until: request?.until || undefined,
      limit: Math.min(50, Math.max(budget.maxMessages, 10)),
      includeBody: true
    }) as Record<string, unknown>;
    if (controller.signal.aborted) throw cancelled();
    if (typeof payload.result === 'string') {
      throw new Error(`${String(payload.reason ?? 'The search could not be verified.')} ${String(payload.remedy ?? '')}`.trim());
    }
    const grounded = buildGroundedPrompt(task, question, payload, budget);
    send({ type: 'sources', task, label: TASK_LABELS[task], sources: grounded.sources, caveats: grounded.caveats, interpretation: payload.interpretation, totalMatches: payload.totalMatches });
    if (grounded.sources.length === 0) {
      send({ type: 'token', token: "No messages matched, so there is nothing to analyse. Try different wording, widen the dates, or sync with OurFamilyWizard first." });
      send({ type: 'done' });
      return { ok: true };
    }
    return await streamQwenToSender(event.sender, requestId, grounded.messages, { maxTokens, controller });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OFW analysis failed.';
    send({ type: 'error', ...(error instanceof QwenError ? { code: error.code } : {}), error: message });
    return { ok: false, error: message };
  } finally {
    release();
  }
});

// Retrieval for the Qwen chat panel: the few messages relevant to this
// question, as cited excerpts — instead of the whole record.
ipcMain.handle('agent-force:ofw-chat-context', async (event, question: unknown) => {
  if (!trusted(event)) return UNTRUSTED;
  try {
    const q = typeof question === 'string' ? question.trim().slice(0, 500) : '';
    if (!q) return { ok: false, error: 'No question.' };
    assertLocalModelForOfw();
    const budget = groundingBudget(process.env);
    const payload = await getOfwConnection().request('nlsearch', { query: q, mode: 'natural', limit: Math.min(50, Math.max(budget.maxMessages, 10)), includeBody: true }) as Record<string, unknown>;
    if (typeof payload.result === 'string') return { ok: false, error: String(payload.reason ?? 'OFW search could not be verified.') };
    const { context, sources } = buildChatContext(q, payload, { ...budget, maxChars: Math.min(budget.maxChars, 4500) });
    return { ok: true, data: { context, sources, interpretation: payload.interpretation } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'OFW context unavailable.' };
  }
});

ipcMain.on('agent-force:qwen-cancel', (event, requestId: unknown) => {
  if (!trusted(event) || !isValidRequestId(requestId)) return;
  const stream = activeQwenStreams.get(requestId);
  if (stream?.senderId === event.sender.id) stream.controller.abort();
});

ipcMain.handle('agent-force:ofw', async (event, action: unknown, input: unknown) => {
  if (!trusted(event)) return UNTRUSTED;
  try {
    return { ok: true, data: await getOfwConnection().request(action, input) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'OFW read failed.' };
  }
});

app.whenReady().then(() => {
  createWindow();
  ensureManagedLocalLlm(getQwenConfig()).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Managed Qwen startup failed.');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  securityService?.shutdown();
  stopManagedLocalLlm();
  void ofwConnection?.close();
});
