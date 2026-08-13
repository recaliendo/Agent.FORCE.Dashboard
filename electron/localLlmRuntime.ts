import { spawn, type ChildProcess } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';

type ManagedLlmOptions = {
  baseUrl: string;
  apiKey: string;
  modelName: string;
};

type EndpointProbe = {
  reachable: boolean;
  ready: boolean;
  status?: number;
  error?: string;
};

let managedProcess: ChildProcess | null = null;
let managedLogFd: number | null = null;
let startupPromise: Promise<void> | null = null;

function defaultRuntimeRoot() {
  return path.join(process.env.LOCALAPPDATA || process.cwd(), 'AgentFORCE');
}

function envNumber(name: string, fallback: number, minimum = 0) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

function isLoopbackUrl(baseUrl: string) {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

function getManagedPaths() {
  const root = process.env.LLAMA_RUNTIME_ROOT || defaultRuntimeRoot();
  return {
    root,
    server: process.env.LLAMA_SERVER_PATH || path.join(root, 'llama.cpp', 'llama-server.exe'),
    model: process.env.LLAMA_MODEL_PATH || path.join(root, 'models', 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf'),
    mmproj: process.env.LLAMA_MMPROJ_PATH || '',
    apiKeyFile: process.env.LLAMA_API_KEY_FILE || path.join(root, 'secrets', 'api-key.txt'),
    log: process.env.LLAMA_LOG_PATH || path.join(root, 'logs', 'llama-server.log')
  };
}

async function probeEndpoint(options: ManagedLlmOptions, timeoutMs = 2000): Promise<EndpointProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${options.baseUrl.replace(/\/+$/, '')}/models`, {
      method: 'GET',
      headers: options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : undefined,
      signal: controller.signal
    });
    return { reachable: true, ready: response.ok, status: response.status };
  } catch (error) {
    return {
      reachable: false,
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown endpoint error.'
    };
  } finally {
    clearTimeout(timeout);
  }
}

function launchManagedServer(options: ManagedLlmOptions) {
  const paths = getManagedPaths();
  if (!existsSync(paths.server)) {
    throw new Error(`Managed llama.cpp server is missing at ${paths.server}. Run npm run qwen:setup.`);
  }
  if (!existsSync(paths.model)) {
    throw new Error(`Managed Qwen model is missing at ${paths.model}. Run npm run qwen:setup.`);
  }

  const endpoint = new URL(options.baseUrl);
  const port = endpoint.port || (endpoint.protocol === 'https:' ? '443' : '80');
  const host = endpoint.hostname === 'localhost' || endpoint.hostname === '::1' ? '127.0.0.1' : endpoint.hostname;
  const args = [
    '--model', paths.model,
    '--host', host,
    '--port', port,
    '--alias', options.modelName,
    '--ctx-size', String(envNumber('LLAMA_CONTEXT_SIZE', 8192, 512)),
    '--n-gpu-layers', String(envNumber('LLAMA_GPU_LAYERS', 12, 0)),
    '--parallel', '1',
    '--flash-attn', 'on',
    '--cache-type-k', 'q8_0',
    '--cache-type-v', 'q8_0',
    '--jinja'
  ];

  if (paths.mmproj) {
    if (!existsSync(paths.mmproj)) {
      throw new Error(`Configured multimodal projector is missing at ${paths.mmproj}.`);
    }
    args.push('--mmproj', paths.mmproj);
  }
  if (options.apiKey) {
    if (existsSync(paths.apiKeyFile)) args.push('--api-key-file', paths.apiKeyFile);
    else args.push('--api-key', options.apiKey);
  }

  mkdirSync(path.dirname(paths.log), { recursive: true });
  managedLogFd = openSync(paths.log, 'a');
  const child = spawn(paths.server, args, {
    cwd: path.dirname(paths.server),
    windowsHide: true,
    stdio: ['ignore', managedLogFd, managedLogFd]
  });
  managedProcess = child;

  child.once('exit', () => {
    if (managedProcess === child) managedProcess = null;
    if (managedLogFd !== null) {
      closeSync(managedLogFd);
      managedLogFd = null;
    }
  });
  return { child, logPath: paths.log };
}

async function startAndWait(options: ManagedLlmOptions) {
  const initialProbe = await probeEndpoint(options);
  if (initialProbe.ready) return;
  if (initialProbe.reachable) {
    throw new Error(`LLM endpoint is reachable but returned HTTP ${initialProbe.status}. Check LLM_API_KEY and LLM_BASE_URL.`);
  }

  const { child, logPath } = launchManagedServer(options);
  const timeoutMs = envNumber('LLM_STARTUP_TIMEOUT_SECONDS', 180, 5) * 1000;
  const deadline = Date.now() + timeoutMs;
  let spawnError = '';
  child.once('error', (error) => { spawnError = error.message; });

  while (Date.now() < deadline) {
    if (spawnError) throw new Error(`llama.cpp failed to start: ${spawnError}. Log: ${logPath}`);
    if (child.exitCode !== null) {
      throw new Error(`llama.cpp exited with code ${child.exitCode} before becoming ready. Log: ${logPath}`);
    }
    const probe = await probeEndpoint(options);
    if (probe.ready) return;
    if (probe.reachable && probe.status && probe.status !== 503) {
      throw new Error(`llama.cpp returned HTTP ${probe.status} during startup. Log: ${logPath}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  child.kill();
  throw new Error(`llama.cpp did not become ready within ${timeoutMs / 1000}s. Log: ${logPath}`);
}

export async function ensureManagedLocalLlm(options: ManagedLlmOptions) {
  if (!isLoopbackUrl(options.baseUrl) || process.env.LLM_AUTOSTART === 'false') return;
  if (!startupPromise) {
    startupPromise = startAndWait(options).finally(() => {
      startupPromise = null;
    });
  }
  await startupPromise;
}

export function stopManagedLocalLlm() {
  if (managedProcess && managedProcess.exitCode === null) managedProcess.kill();
  managedProcess = null;
  startupPromise = null;
}

export function getManagedLocalLlmState(baseUrl: string) {
  const paths = getManagedPaths();
  return {
    autostart: isLoopbackUrl(baseUrl) && process.env.LLM_AUTOSTART !== 'false',
    running: Boolean(managedProcess && managedProcess.exitCode === null),
    serverPath: paths.server,
    modelPath: paths.model,
    logPath: paths.log
  };
}
