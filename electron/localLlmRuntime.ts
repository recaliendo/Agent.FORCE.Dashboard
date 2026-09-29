import { spawn, type ChildProcess } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { isLoopbackBaseUrl } from './loopback.js';

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

function envValue(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
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
  const hostname = endpoint.hostname.replace(/^\[|\]$/g, '');
  const host = hostname === 'localhost' || hostname === '::1' ? '127.0.0.1' : hostname;
  const cpuMoeLayers = envNumber('LLAMA_CPU_MOE_LAYERS', 32, 0);
  const loadMode = envValue('LLAMA_LOAD_MODE', 'none');
  const specType = envValue('LLAMA_SPEC_TYPE', 'none');
  const args = [
    '--model', paths.model,
    '--host', host,
    '--port', port,
    '--alias', options.modelName,
    '--ctx-size', String(envNumber('LLAMA_CONTEXT_SIZE', 8192, 512)),
    '--n-gpu-layers', envValue('LLAMA_GPU_LAYERS', 'all'),
    '--parallel', '1',
    '--flash-attn', 'on',
    '--cache-type-k', 'q8_0',
    '--cache-type-v', 'q8_0',
    '--load-mode', loadMode,
    '--jinja'
  ];

  if (cpuMoeLayers > 0) args.push('--n-cpu-moe', String(cpuMoeLayers));
  if (specType !== 'none') {
    args.push('--spec-type', specType);
    args.push('--spec-draft-n-max', String(envNumber('LLAMA_SPEC_DRAFT_N_MAX', 2, 1)));
  }

  if (paths.mmproj) {
    if (!existsSync(paths.mmproj)) {
      throw new Error(`Configured multimodal projector is missing at ${paths.mmproj}.`);
    }
    args.push('--mmproj', paths.mmproj);
  }
  // The key never goes on the command line, where any local process can read
  // it: use the key file, or else llama-server's LLAMA_API_KEY variable.
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  delete childEnv.LLAMA_API_KEY;
  if (options.apiKey) {
    if (existsSync(paths.apiKeyFile)) args.push('--api-key-file', paths.apiKeyFile);
    else childEnv.LLAMA_API_KEY = options.apiKey;
  }

  mkdirSync(path.dirname(paths.log), { recursive: true });
  closeLog();
  const logFd = openSync(paths.log, 'a');
  managedLogFd = logFd;
  const child = spawn(paths.server, args, {
    cwd: path.dirname(paths.server),
    env: childEnv,
    windowsHide: true,
    stdio: ['ignore', logFd, logFd]
  });
  managedProcess = child;

  // 'exit' never fires when the spawn itself fails, so release on 'error' too.
  const release = () => {
    if (managedProcess === child) managedProcess = null;
    if (managedLogFd === logFd) closeLog();
  };
  child.once('exit', release);
  child.once('error', release);
  return { child, logPath: paths.log };
}

function closeLog() {
  if (managedLogFd === null) return;
  try { closeSync(managedLogFd); } catch { /* already closed */ }
  managedLogFd = null;
}

async function waitForReady(options: ManagedLlmOptions, timeoutMs: number, context: string) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = await probeEndpoint(options);
    if (probe.ready) return;
    if (!probe.reachable) throw new Error(`The LLM server at ${options.baseUrl} stopped answering while ${context}.`);
    if (probe.status !== 503) throw new Error(`LLM endpoint returned HTTP ${probe.status} while ${context}. Check LLM_API_KEY and LLM_BASE_URL.`);
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`The LLM server at ${options.baseUrl} was still loading after ${timeoutMs / 1000}s.`);
}

async function startAndWait(options: ManagedLlmOptions) {
  const initialProbe = await probeEndpoint(options);
  if (initialProbe.ready) return;
  if (initialProbe.reachable) {
    // A server is already on the port. 503 means it is loading the model
    // (started by an earlier run or by qwen:start): wait for it, don't fail.
    if (initialProbe.status === 503) {
      await waitForReady(options, envNumber('LLM_STARTUP_TIMEOUT_SECONDS', 180, 5) * 1000, 'loading the model');
      return;
    }
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
  if (!isLoopbackBaseUrl(options.baseUrl) || process.env.LLM_AUTOSTART === 'false') return;
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
  closeLog();
}

export function getManagedLocalLlmState(baseUrl: string) {
  const paths = getManagedPaths();
  return {
    autostart: isLoopbackBaseUrl(baseUrl) && process.env.LLM_AUTOSTART !== 'false',
    running: Boolean(managedProcess && managedProcess.exitCode === null),
    serverPath: paths.server,
    modelPath: paths.model,
    logPath: paths.log
  };
}
