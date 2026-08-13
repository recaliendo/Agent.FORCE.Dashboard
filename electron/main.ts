import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { exec } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureManagedLocalLlm, getManagedLocalLlmState, stopManagedLocalLlm } from './localLlmRuntime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const allowCommands = process.env.AGENT_FORCE_ALLOW_COMMANDS === 'true';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

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

  return {
    baseUrl,
    apiKey,
    modelName,
    timeoutMs: Number.isFinite(timeoutSeconds) ? Math.max(1, timeoutSeconds) * 1000 : 5000
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

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

async function qwenFetch(pathname: string, init: RequestInit = {}) {
  const config = getQwenConfig();
  assertSafeLlmBaseUrl(config.baseUrl);
  const { controller, timeout } = withTimeout(config.timeoutMs);

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
      const body = await response.text().catch(() => '');
      throw new Error(`LLM endpoint returned HTTP ${response.status}${body ? `: ${body}` : ''}`);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`LLM endpoint timed out after ${config.timeoutMs / 1000}s at ${config.baseUrl}`);
    }
    if (error instanceof Error) {
      throw new Error(`LLM endpoint failed at ${config.baseUrl}: ${error.message}`);
    }
    throw new Error(`LLM endpoint failed at ${config.baseUrl}.`);
  } finally {
    clearTimeout(timeout);
  }
}

async function qwenChatCompletion(messages: ChatMessage[], stream = false) {
  const config = getQwenConfig();
  await ensureManagedLocalLlm(config);
  const response = await qwenFetch('chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: config.modelName,
      messages,
      temperature: 0.2,
      chat_template_kwargs: { enable_thinking: false },
      stream
    })
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
    await ensureManagedLocalLlm(getQwenConfig());
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

ipcMain.handle('agent-force:qwen-stream-chat', async (event, requestId: string, messages: ChatMessage[]) => {
  try {
    const response = await qwenChatCompletion(messages, true);
    const reader = (response.body as any)?.getReader?.();
    if (!reader) {
      throw new Error('LLM endpoint did not provide a readable stream.');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          event.sender.send(`agent-force:qwen-stream:${requestId}`, { type: 'done' });
          return { ok: true };
        }
        const chunk = JSON.parse(data);
        const token = chunk?.choices?.[0]?.delta?.content;
        if (typeof token === 'string' && token) {
          event.sender.send(`agent-force:qwen-stream:${requestId}`, { type: 'token', token });
        }
      }
    }

    event.sender.send(`agent-force:qwen-stream:${requestId}`, { type: 'done' });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Qwen stream request failed.';
    event.sender.send(`agent-force:qwen-stream:${requestId}`, { type: 'error', error: message });
    return { ok: false, error: message };
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
});
