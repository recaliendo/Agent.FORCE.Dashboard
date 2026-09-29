import path from 'node:path';
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import { fetchServerProps, QwenError, serverRoot, streamChatCompletion, type QwenClientConfig, type QwenStats } from './qwenClient.js';

/**
 * Qwen doctor: one pass that answers "why is the local model not working?"
 * with measurements instead of guesses. Used by the app's Health button (IPC
 * `agent-force:qwen-doctor`) and by `pnpm qwen:doctor` on the command line,
 * whose output is safe to paste: credentials and key-like strings are never
 * printed.
 */

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface DoctorCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  remedy?: string;
}

export interface DoctorMeasurements {
  contextSize?: number;
  buildInfo?: string;
  firstTokenMs?: number;
  promptTokensPerSecond?: number;
  generationTokensPerSecond?: number;
  cachedTokenShare?: number;
  progressFrames?: number;
}

export interface DoctorReport {
  generatedAt: string;
  baseUrl: string;
  modelName: string;
  checks: DoctorCheck[];
  measurements: DoctorMeasurements;
  logTail: string[];
  verdict: CheckStatus;
  summary: string;
}

export interface DoctorRuntime {
  autostart: boolean;
  running: boolean;
  serverPath: string;
  modelPath: string;
  logPath: string;
}

export interface DoctorInput {
  client: QwenClientConfig;
  runtime?: DoctorRuntime;
  /** Try to start the managed server first (the app does; the CLI does not). */
  ensureRuntime?: () => Promise<void>;
  /** Skip the inference measurements (fast mode). */
  quick?: boolean;
}

/**
 * Log lines that explain a runtime failure, with what to do about each.
 * Ordered most specific first; a line is attributed to its FIRST match only —
 * "error loading model: unable to allocate CUDA0 buffer" is a GPU-memory
 * failure, and sending someone to re-download a 22 GB model would be wrong.
 */
const LOG_PATTERNS: Array<{ pattern: RegExp; label: string; remedy: string }> = [
  { pattern: /out of memory|cudaMalloc failed|(?:failed|unable) to allocate|CUDA error: out of memory/i, label: 'The GPU ran out of memory', remedy: 'Close GPU-heavy apps (games, video, other models), or raise LLAMA_CPU_MOE_LAYERS by 1–2 so more of the model stays in system RAM, then restart the dashboard.' },
  { pattern: /error loading model|failed to load model|unable to load model|invalid magic|gguf_init_from_file/i, label: 'The model file could not be loaded', remedy: 'The GGUF may be missing, incomplete, or the wrong file. Re-run pnpm qwen:setup, or point LLAMA_MODEL_PATH at the complete Qwen3.6-35B-A3B-UD-Q4_K_M.gguf.' },
  { pattern: /couldn't bind|address already in use|bind failed|only one usage of each socket address/i, label: 'Port 8080 is already in use', remedy: 'Another program (or an old llama-server) holds the port. Close it, or change the port in LLM_BASE_URL and restart.' },
  { pattern: /exceeds the available context size|larger than the max context size/i, label: 'A prompt was larger than the model\'s context window', remedy: 'The updated dashboard budgets prompts automatically. If this persists, lower OFW_ANALYSIS_MAX_CHARS.' },
  { pattern: /invalid api key|unauthorized/i, label: 'Requests were rejected for a bad API key', remedy: 'LLM_API_KEY in .env must match the key llama-server was started with (LLAMA_API_KEY_FILE).' }
];

const SECRET_PATTERNS: RegExp[] = [
  /(--api-key(?:-file)?\s+)\S+/gi,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /(api[_-]?key["'=:\s]+)[A-Za-z0-9._~+/=-]{8,}/gi,
  // Credentials by name: OFW_PASSWORD=…, password: …, "token": "…", secret=…
  /((?:pass(?:word|wd)?|pwd|secret|token|credential)s?["']?\s*[=:]\s*["']?)[^\s"',;&]{3,}/gi,
  /\b(?:sk|ghp|github_pat|hf)[-_][A-Za-z0-9_-]{10,}/g,
  /\b[A-Fa-f0-9]{32,}\b/g
];

export function redact(line: string): string {
  let out = line;
  for (const pattern of SECRET_PATTERNS) {
    // Patterns with a capture group keep their label ("Bearer ", "--api-key ").
    out = out.replace(pattern, (_match, prefix: unknown) => `${typeof prefix === 'string' ? prefix : ''}[redacted]`);
  }
  return out;
}

/** Last `maxLines` of a (possibly large) log file, redacted. */
/**
 * The app writes llama-server.log; `pnpm qwen:start` writes
 * llama-server.stderr.log beside it. Read whichever was written last.
 */
export function newestLog(logPath: string): string {
  const candidates = [logPath, path.join(path.dirname(logPath), 'llama-server.stderr.log')].filter((p) => p && existsSync(p));
  if (!candidates.length) return logPath;
  return candidates.reduce((a, b) => (statSync(b).mtimeMs > statSync(a).mtimeMs ? b : a));
}

export function readLogTail(logPath: string, maxLines = 40, maxBytes = 64 * 1024): string[] {
  if (!logPath || !existsSync(logPath)) return [];
  const size = statSync(logPath).size;
  const start = Math.max(0, size - maxBytes);
  const buffer = Buffer.alloc(size - start);
  const fd = openSync(logPath, 'r');
  try {
    readSync(fd, buffer, 0, buffer.length, start);
  } finally {
    closeSync(fd);
  }
  return buffer.toString('utf8').split(/\r?\n/).filter((l) => l.trim()).slice(-maxLines).map(redact);
}

async function probe(url: string, apiKey: string, timeoutMs: number): Promise<{ status?: number; body?: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined, signal: controller.signal });
    let body = '';
    try { body = (await response.text()).slice(0, 400); } catch { /* ignore */ }
    return { status: response.status, body };
  } catch (error) {
    const cause = (error as { cause?: unknown } | null)?.cause;
    return { error: cause instanceof Error ? cause.message : error instanceof Error ? error.message : 'unknown error' };
  } finally {
    clearTimeout(timer);
  }
}

function isLoopback(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

/** A stable ~900-token prompt for measuring prompt-read speed. */
function measurementPrompt(): string {
  const lines: string[] = [];
  for (let i = 1; i <= 40; i++) {
    lines.push(`Record ${i}: On day ${i}, the parents discussed the school pickup schedule, the soccer practice time, and a $${(i * 7) % 90 + 10} copay that was split between them.`);
  }
  return `${lines.join('\n')}\nReply with the single word OK.`;
}

export async function runQwenDoctor(input: DoctorInput): Promise<DoctorReport> {
  const { client, runtime } = input;
  const checks: DoctorCheck[] = [];
  const measurements: DoctorMeasurements = {};
  const add = (check: DoctorCheck) => checks.push(check);
  const root = serverRoot(client.baseUrl);
  const local = isLoopback(client.baseUrl);

  add(local
    ? { id: 'endpoint', label: 'Model endpoint', status: 'pass', detail: `${client.baseUrl} (on this computer)` }
    : { id: 'endpoint', label: 'Model endpoint', status: 'warn', detail: `${new URL(client.baseUrl).host} is not on this computer.`, remedy: 'OFW records are never sent to a remote model unless OFW_ALLOW_REMOTE_LLM=true. Use http://127.0.0.1:8080/v1 for the local Qwen server.' });

  if (runtime?.autostart) {
    const serverOk = existsSync(runtime.serverPath);
    const modelOk = existsSync(runtime.modelPath);
    add({
      id: 'runtime-files',
      label: 'Local runtime files',
      status: serverOk && modelOk ? 'pass' : 'fail',
      detail: serverOk && modelOk
        ? `llama-server and model found${modelOk ? ` (${Math.round(statSync(runtime.modelPath).size / 1e9 * 10) / 10} GB)` : ''}`
        : [!serverOk ? `llama-server not found at ${runtime.serverPath}` : '', !modelOk ? `model not found at ${runtime.modelPath}` : ''].filter(Boolean).join('; '),
      remedy: serverOk && modelOk ? undefined : 'Run pnpm qwen:setup, or set LLAMA_SERVER_PATH / LLAMA_MODEL_PATH in .env to the real locations.'
    });
  } else if (runtime) {
    add({ id: 'runtime-files', label: 'Local runtime files', status: 'skip', detail: 'Autostart is off (LLM_AUTOSTART=false); the server must be started separately (pnpm qwen:start).' });
  }

  if (input.ensureRuntime) {
    try {
      await input.ensureRuntime();
    } catch (error) {
      add({ id: 'runtime-start', label: 'Start local runtime', status: 'fail', detail: error instanceof Error ? redact(error.message) : 'The managed runtime did not start.', remedy: 'See the runtime log lines below for the reason.' });
    }
  }

  // Reachability. llama.cpp answers /health with 503 while the model loads.
  const health = await probe(`${root}/health`, client.apiKey, 4000);
  let reachable = false;
  if (health.error) {
    add({ id: 'reachable', label: 'Server reachable', status: 'fail', detail: `Nothing is answering at ${root} (${health.error}).`, remedy: runtime?.autostart ? 'Open the dashboard (it starts the server) or run pnpm qwen:start, then run the doctor again. If it still fails, read the runtime log lines below.' : 'Start the server with pnpm qwen:start.' });
  } else if (health.status === 503) {
    reachable = true;
    add({ id: 'reachable', label: 'Server reachable', status: 'warn', detail: 'The server is up but still loading the model into memory (about 20–30 s after start).', remedy: 'Wait for loading to finish, then run the doctor again.' });
  } else if (health.status === 200) {
    reachable = true;
    add({ id: 'reachable', label: 'Server reachable', status: 'pass', detail: `${root}/health answered OK.` });
  } else {
    reachable = true;
    add({ id: 'reachable', label: 'Server reachable', status: health.status === 404 ? 'skip' : 'warn', detail: `/health answered HTTP ${health.status}${health.status === 404 ? ' (not a llama.cpp server; health check skipped)' : ''}.` });
  }

  if (reachable) {
    const models = await probe(`${client.baseUrl}/models`, client.apiKey, 5000);
    if (models.status === 401 || models.status === 403) {
      add({ id: 'auth', label: 'Credential accepted', status: 'fail', detail: 'The server rejected the API key the dashboard sends.', remedy: 'LLM_API_KEY in .env must match the key llama-server was started with (LLAMA_API_KEY_FILE). Re-run pnpm qwen:setup to regenerate both.' });
    } else if (models.status === 200) {
      add({ id: 'auth', label: 'Credential accepted', status: 'pass', detail: client.apiKey ? 'The API key was accepted.' : 'No API key is configured and the server does not require one.' });
    } else if (models.status !== undefined) {
      add({ id: 'auth', label: 'Credential accepted', status: models.status === 503 ? 'warn' : 'skip', detail: `/models answered HTTP ${models.status}.` });
    }

    const props = await fetchServerProps(client);
    if (props?.nCtx) {
      measurements.contextSize = props.nCtx;
      measurements.buildInfo = props.buildInfo;
      add({
        id: 'context',
        label: 'Context window',
        status: props.nCtx >= 8192 ? 'pass' : 'warn',
        detail: `${props.nCtx.toLocaleString()} tokens${props.buildInfo ? ` · llama.cpp ${props.buildInfo}` : ''}`,
        remedy: props.nCtx >= 8192 ? undefined : 'Grounded OFW answers need room for excerpts; set LLAMA_CONTEXT_SIZE=8192 (the tested value) and restart.'
      });
    }

    const slots = await probe(`${root}/slots`, client.apiKey, 3000);
    if (slots.status === 200 && slots.body && /"is_processing"\s*:\s*true/.test(slots.body)) {
      add({ id: 'busy', label: 'Server idle', status: 'warn', detail: 'The model is busy with another request right now, so the timings below include waiting.', remedy: 'Run the doctor again when nothing else is using Qwen.' });
    }
  }

  const canInfer = reachable && !checks.some((c) => (c.id === 'auth' || c.id === 'runtime-start') && c.status === 'fail') && health.status !== 503;
  if (!input.quick && canInfer) {
    // 1. First token on a tiny prompt: is inference working at all?
    const t0 = Date.now();
    let firstTokenAt = 0;
    try {
      await streamChatCompletion(client, [{ role: 'user', content: 'Reply with the single word OK.' }], {
        maxTokens: 8,
        temperature: 0,
        onEvent: (e) => { if (e.type === 'token' && !firstTokenAt) firstTokenAt = Date.now(); }
      });
      measurements.firstTokenMs = (firstTokenAt || Date.now()) - t0;
      add({
        id: 'first-token',
        label: 'Model answers',
        status: measurements.firstTokenMs < 5000 ? 'pass' : 'warn',
        detail: `First word after ${(measurements.firstTokenMs / 1000).toFixed(1)} s.`,
        remedy: measurements.firstTokenMs < 5000 ? undefined : 'Slow even for a tiny prompt: the model may still be paging in after start-up, or another program is using the GPU.'
      });
    } catch (error) {
      add(inferenceFailure('first-token', 'Model answers', error));
    }

    // 2. Prompt-read and write speed on a ~900-token prompt, uncached.
    let progressFrames = 0;
    let stats: QwenStats | null = null;
    try {
      const result = await streamChatCompletion(client, [{ role: 'user', content: measurementPrompt() }], {
        maxTokens: 24,
        temperature: 0,
        cachePrompt: false,
        onEvent: (e) => { if (e.type === 'progress') progressFrames += 1; }
      });
      stats = result.stats;
      measurements.progressFrames = progressFrames;
      if (stats?.promptTokensPerSecond) {
        const pps = stats.promptTokensPerSecond;
        measurements.promptTokensPerSecond = Math.round(pps);
        measurements.generationTokensPerSecond = stats.generationTokensPerSecond ? Math.round(stats.generationTokensPerSecond) : undefined;
        const grounded = Math.round(2500 / pps);
        add({
          id: 'speed',
          label: 'Speed',
          status: pps >= 60 ? 'pass' : 'warn',
          detail: `Reads prompts at ${Math.round(pps)} tokens/s and writes at ${measurements.generationTokensPerSecond ?? '?'} tokens/s. A grounded OFW question (~2,500 tokens) takes about ${grounded} s to read before the answer starts.`,
          remedy: pps >= 60 ? undefined : 'Prompt reading is slow. Check that the GPU is being used (LLAMA_GPU_LAYERS=all with LLAMA_CPU_MOE_LAYERS=32 is the tested profile), close other GPU-heavy apps, and keep the laptop on mains power.'
        });
      } else {
        add({ id: 'speed', label: 'Speed', status: 'skip', detail: 'The server did not report timings (not llama.cpp).' });
      }
      add(progressFrames > 0
        ? { id: 'progress', label: 'Progress while reading', status: 'pass', detail: 'The server reports prompt-reading progress, so long prompts show a live percentage.' }
        : { id: 'progress', label: 'Progress while reading', status: 'warn', detail: 'The server did not report prompt-reading progress.', remedy: 'Update llama.cpp (pnpm qwen:setup) so long prompts show progress instead of appearing stalled.' });
    } catch (error) {
      add(inferenceFailure('speed', 'Speed', error));
    }

    // 3. The same prompt again: is the prompt cache reused?
    if (stats) {
      try {
        const again = await streamChatCompletion(client, [{ role: 'user', content: measurementPrompt() }], { maxTokens: 4, temperature: 0 });
        const cached = again.stats?.cachedTokens ?? 0;
        const total = cached + (again.stats?.promptTokens ?? 0);
        if (total > 0) {
          measurements.cachedTokenShare = Math.round((cached / total) * 100);
          add({
            id: 'cache',
            label: 'Prompt cache',
            status: measurements.cachedTokenShare >= 80 ? 'pass' : 'warn',
            detail: `${measurements.cachedTokenShare}% of a repeated prompt was reused from cache.`,
            remedy: measurements.cachedTokenShare >= 80 ? undefined : 'Follow-up questions will re-read everything. Keep --parallel 1 and do not disable cache_prompt.'
          });
        }
      } catch {
        /* the speed check already reported the failure */
      }
    }
  }

  const logTail = runtime ? readLogTail(newestLog(runtime.logPath)) : [];
  const seen = new Set<string>();
  for (const line of logTail) {
    const known = LOG_PATTERNS.find((candidate) => candidate.pattern.test(line));
    if (known && !seen.has(known.label)) {
      seen.add(known.label);
      add({ id: `log-${seen.size}`, label: 'Runtime log', status: 'fail', detail: `${known.label}: “${line.trim().slice(0, 180)}”`, remedy: known.remedy });
    }
  }

  const verdict: CheckStatus = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  const firstProblem = checks.find((c) => c.status === 'fail') ?? checks.find((c) => c.status === 'warn');
  const summary = verdict === 'pass' ? healthySummary(measurements) : `${firstProblem?.label}: ${firstProblem?.detail}`;

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: client.baseUrl,
    modelName: client.modelName,
    checks,
    measurements,
    logTail,
    verdict,
    summary
  };
}

/** Only what was actually measured: a --quick run measures no speeds. */
function healthySummary(m: DoctorMeasurements): string {
  const parts: string[] = [];
  if (m.firstTokenMs !== undefined) parts.push(`first word in ${(m.firstTokenMs / 1000).toFixed(1)} s`);
  if (m.promptTokensPerSecond !== undefined) parts.push(`reads ${m.promptTokensPerSecond} tokens/s`);
  if (m.generationTokensPerSecond !== undefined) parts.push(`writes ${m.generationTokensPerSecond} tokens/s`);
  return parts.length ? `Qwen is healthy: ${parts.join(', ')}.` : 'Qwen is reachable and configured correctly (speed not measured).';
}

function inferenceFailure(id: string, label: string, error: unknown): DoctorCheck {
  const code = error instanceof QwenError ? error.code : 'HTTP_ERROR';
  const detail = error instanceof Error ? redact(error.message) : 'Inference failed.';
  const remedies: Record<string, string> = {
    SERVER_UNAVAILABLE: 'The server stopped answering. Check the runtime log lines below.',
    AUTH_FAILED: 'LLM_API_KEY in .env must match the key llama-server was started with.',
    MODEL_LOADING: 'Wait for the model to finish loading, then run the doctor again.',
    QUEUE_TIMEOUT: 'The single slot stayed busy. Close other Qwen requests and try again.',
    INACTIVITY_TIMEOUT: 'The server went silent mid-request; check the runtime log for a crash.',
    CONTEXT_OVERFLOW: 'Increase LLAMA_CONTEXT_SIZE (8192 is the tested value).'
  };
  return { id, label, status: 'fail', detail, remedy: remedies[code] };
}

const ICON: Record<CheckStatus, string> = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', skip: 'SKIP' };

/** Plain-text report for the terminal or for pasting into a support thread. */
export function formatDoctorReport(report: DoctorReport, appBuild?: string): string {
  const lines = [
    `Agent FORCE — Qwen doctor (${report.generatedAt})`,
    appBuild ? `Dashboard build: ${appBuild}` : '',
    `Endpoint: ${report.baseUrl} · model ${report.modelName}`,
    `Verdict: ${ICON[report.verdict]} — ${report.summary}`,
    '',
    ...report.checks.map((c) => `[${ICON[c.status]}] ${c.label}: ${c.detail}${c.remedy ? `\n       → ${c.remedy}` : ''}`)
  ].filter((l, i) => l !== '' || i > 0);
  if (report.logTail.length) {
    lines.push('', `Last ${report.logTail.length} runtime log lines (secrets redacted):`, ...report.logTail.map((l) => `  ${l}`));
  }
  return lines.join('\n');
}
