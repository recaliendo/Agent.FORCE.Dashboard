import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { exec } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureManagedLocalLlm, getManagedLocalLlmState, stopManagedLocalLlm } from './localLlmRuntime.js';
import { createSseDataParser } from './sseParser.js';
import { OfwConnection } from './ofw.js';
import { ANALYSIS_TASKS, buildChatContext, buildGroundedPrompt, groundingBudget, isLoopbackBaseUrl, TASK_LABELS, type AnalysisTask } from './ofw-grounding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const allowCommands = process.env.AGENT_FORCE_ALLOW_COMMANDS === 'true';
let ofwConnection: OfwConnection;

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ActiveQwenStream = {
  controller: AbortController;
  senderId: number;
};

const activeQwenStreams = new Map<string, ActiveQwenStream>();

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    const name = key.trim();
    const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (name && process.env[name] === undefined) {
      process.env[name] = value;
    }
  }
}

loadDotEnv();

function getQwenConfig() {
  const baseUrl = (process.env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1').replace(/\/+$/, '');
  const apiKey = process.env.LLM_API_KEY || process.env.LLAMA_API_KEY || '';
  const modelName = process.env.LLM_MODEL_NAME || 'Qwen/Qwen3.6-35B-A3B';
  const timeoutSeconds = Number(process.env.LLM_TIMEOUT_SECONDS || '5');
  const inferenceConnectSeconds = Number(process.env.LLM_INFERENCE_CONNECT_TIMEOUT_SECONDS || '10');
  const inferenceInactivitySeconds = Number(process.env.LLM_INFERENCE_INACTIVITY_TIMEOUT_SECONDS || '30');
  const maxOutputTokens = Number(process.env.LLM_MAX_OUTPUT_TOKENS || '512');

  return {
    baseUrl,
    apiKey,
    modelName,
    timeoutMs: Number.isFinite(timeoutSeconds) ? Math.max(1, timeoutSeconds) * 1000 : 5000,
    inferenceConnectTimeoutMs: Number.isFinite(inferenceConnectSeconds) ? Math.max(1, inferenceConnectSeconds) * 1000 : 10000,
    inferenceInactivityTimeoutMs: Number.isFinite(inferenceInactivitySeconds) ? Math.max(5, inferenceInactivitySeconds) * 1000 : 30000,
    maxOutputTokens: Number.isFinite(maxOutputTokens) ? Math.min(4096, Math.max(64, Math.floor(maxOutputTokens))) : 512
  };
}

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

async function qwenChatCompletion(
  messages: ChatMessage[],
  stream = false,
  controller?: AbortController,
  onRuntimeReady?: () => void
) {
  const config = getQwenConfig();
  if (controller?.signal.aborted) throw new Error('CANCELLED: The inference request was cancelled.');
  await ensureManagedLocalLlm(config);
  if (controller?.signal.aborted) throw new Error('CANCELLED: The inference request was cancelled.');
  onRuntimeReady?.();
  const response = await qwenFetch('chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: config.modelName,
      messages,
      temperature: 0.2,
      max_tokens: config.maxOutputTokens,
      chat_template_kwargs: { enable_thinking: false },
      stream
    })
  }, {
    controller,
    connectTimeoutMs: config.inferenceConnectTimeoutMs
  });
  return response;
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
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function isSafeUrl(target: string) {
  try {
    const parsed = new URL(target);
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

ipcMain.handle('agent-force:open-external', async (_event, target: string) => {
  if (!isSafeUrl(target)) {
    return { ok: false, error: 'Only http, https, and mailto links are allowed.' };
  }

  await shell.openExternal(target);
  return { ok: true };
});

ipcMain.handle('agent-force:reveal-path', async (_event, target: string) => {
  if (!target || target.trim().length < 2) {
    return { ok: false, error: 'No local path configured for this project.' };
  }

  if (!existsSync(target)) {
    return { ok: false, error: 'Configured local path does not exist.' };
  }

  shell.showItemInFolder(target);
  return { ok: true };
});

ipcMain.handle('agent-force:run-command', async (_event, command: string) => {
  if (!allowCommands) {
    return {
      ok: false,
      error: 'Command launching is disabled. Set AGENT_FORCE_ALLOW_COMMANDS=true to enable it.'
    };
  }

  if (!command || command.length > 500) {
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

ipcMain.handle('agent-force:get-platform', async () => process.platform);

ipcMain.handle('agent-force:qwen-config', async () => {
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

ipcMain.handle('agent-force:qwen-health', async () => {
  try {
    await qwenFetch('models', { method: 'GET' });
    const config = getQwenConfig();
    return { ok: true, baseUrl: config.baseUrl, modelName: config.modelName };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Qwen health check failed.' };
  }
});

ipcMain.handle('agent-force:qwen-chat', async (_event, messages: ChatMessage[]) => {
  try {
    const response = await qwenChatCompletion(messages, false);
    const payload = await response.json() as { choices?: { message?: { content?: unknown } }[] };
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return { ok: false, error: 'LLM response did not include assistant content.' };
    }
    return { ok: true, content };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Qwen chat request failed.' };
  }
});

/**
 * Stream a chat completion to the renderer on `agent-force:qwen-stream:<id>`.
 * Shared by the Qwen chat panel and grounded OFW analysis.
 */
async function streamQwenToSender(sender: Electron.WebContents, requestId: string, messages: ChatMessage[]) {
  const event = { sender };
  const controller = new AbortController();
  const stream: ActiveQwenStream = { controller, senderId: event.sender.id };
  const existing = activeQwenStreams.get(requestId);
  if (existing) existing.controller.abort();
  activeQwenStreams.set(requestId, stream);
  const config = getQwenConfig();
  let inactivityTimedOut = false;
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  const resetInactivityTimeout = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      inactivityTimedOut = true;
      controller.abort();
    }, config.inferenceInactivityTimeoutMs);
  };

  try {
    const response = await qwenChatCompletion(messages, true, controller, () => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(`agent-force:qwen-stream:${requestId}`, { type: 'phase', phase: 'prompt-evaluating' });
      }
    });
    const reader = (response.body as any)?.getReader?.();
    if (!reader) {
      throw new Error('LLM endpoint did not provide a readable stream.');
    }

    let sawDone = false;
    const parser = createSseDataParser((data) => {
      if (data === '[DONE]') {
        sawDone = true;
        return;
      }
      const chunk = JSON.parse(data);
      const token = chunk?.choices?.[0]?.delta?.content;
      if (typeof token === 'string' && token) {
        resetInactivityTimeout();
        event.sender.send(`agent-force:qwen-stream:${requestId}`, { type: 'token', token });
      }
    });
    resetInactivityTimeout();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(value);
      if (sawDone) break;
    }
    parser.finish();

    event.sender.send(`agent-force:qwen-stream:${requestId}`, { type: 'done' });
    return { ok: true };
  } catch (error) {
    const message = inactivityTimedOut
      ? `INACTIVITY_TIMEOUT: No visible token arrived for ${config.inferenceInactivityTimeoutMs / 1000}s.`
      : error instanceof SyntaxError
        ? `PARSE_ERROR: ${error.message}`
        : error instanceof Error
          ? error.message
          : 'Qwen stream request failed.';
    if (!event.sender.isDestroyed()) {
      event.sender.send(`agent-force:qwen-stream:${requestId}`, { type: 'error', error: message });
    }
    return { ok: false, error: message };
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (activeQwenStreams.get(requestId) === stream) activeQwenStreams.delete(requestId);
  }
}

ipcMain.handle('agent-force:qwen-stream-chat', async (event, requestId: string, messages: ChatMessage[]) =>
  streamQwenToSender(event.sender, requestId, messages));

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
  const { baseUrl } = getQwenConfig();
  if (!isLoopbackBaseUrl(baseUrl) && process.env.OFW_ALLOW_REMOTE_LLM !== 'true') {
    throw new Error(`REMOTE_MODEL_BLOCKED: OFW records are only sent to a model on this computer, but LLM_BASE_URL points to ${new URL(baseUrl).host}. Use the local Qwen server (http://127.0.0.1:8080/v1), or set OFW_ALLOW_REMOTE_LLM=true if you accept sending records to that provider.`);
  }
}

type AnalyzeRequest = { task?: unknown; query?: unknown; folderId?: unknown; since?: unknown; until?: unknown };

// Grounded analysis: retrieve the relevant messages, then have the local model
// answer / summarize / build a timeline / extract commitments from those
// excerpts only, citing message numbers. Events: sources → phase → token… → done | error.
ipcMain.handle('agent-force:ofw-analyze', async (event, requestId: string, request: AnalyzeRequest) => {
  const channel = `agent-force:qwen-stream:${requestId}`;
  const send = (payload: Record<string, unknown>) => { if (!event.sender.isDestroyed()) event.sender.send(channel, payload); };
  try {
    const task = (ANALYSIS_TASKS as readonly unknown[]).includes(request?.task) ? request.task as AnalysisTask : 'answer';
    const question = typeof request?.query === 'string' ? request.query.trim().slice(0, 500) : '';
    if (task === 'answer' && !question) throw new Error('Type a question to answer.');
    assertLocalModelForOfw();
    send({ type: 'phase', phase: 'retrieving' });
    const budget = groundingBudget(process.env);
    const payload = await getOfwConnection().request('nlsearch', {
      query: question || 'messages',
      mode: 'natural',
      folderId: request?.folderId,
      since: request?.since || undefined,
      until: request?.until || undefined,
      limit: Math.min(50, Math.max(budget.maxMessages, 10)),
      includeBody: true
    }) as Record<string, unknown>;
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
    return await streamQwenToSender(event.sender, requestId, grounded.messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OFW analysis failed.';
    send({ type: 'error', error: message });
    return { ok: false, error: message };
  }
});

// Retrieval for the Qwen chat panel: the few messages relevant to this
// question, as cited excerpts — instead of the whole record.
ipcMain.handle('agent-force:ofw-chat-context', async (_event, question: unknown) => {
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

ipcMain.on('agent-force:qwen-cancel', (event, requestId: string) => {
  const stream = activeQwenStreams.get(requestId);
  if (stream?.senderId === event.sender.id) stream.controller.abort();
});

ipcMain.handle('agent-force:ofw', async (_event, action: unknown, input: unknown) => {
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
  stopManagedLocalLlm();
  void ofwConnection?.close();
});
