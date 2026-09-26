import { createSseDataParser } from './sseParser.js';

/**
 * Streaming chat client for the local llama.cpp server (OpenAI-compatible).
 *
 * Why this exists — each point is a failure observed in the previous inline
 * implementation:
 *
 * - Prompt evaluation is the slow part on this hardware (~130–170 prompt
 *   tokens/s warm, far less cold). The old client allowed 30 s between
 *   *visible* tokens, so a long prompt was killed while the server was still
 *   reading it. Here the request asks for llama.cpp's `return_progress`
 *   frames, and ANY frame — progress, role, content, or the server's own
 *   ": ping" keep-alive — counts as a sign of life.
 * - Every unrecognised failure used to surface as "server unavailable". A
 *   prompt larger than the context window (HTTP 400,
 *   `exceed_context_size_error`), a model still loading (HTTP 503), a busy
 *   single slot, and a real outage now carry distinct codes.
 * - `finish_reason: "length"` (answer cut off at max_tokens) and the server's
 *   own timings were discarded; both are now reported.
 *
 * No Electron imports: the module is exercised directly by node tests against
 * a fake server and by `scripts/qwen-doctor.mjs` against the real one.
 */

export interface QwenClientConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  maxOutputTokens: number;
  /** How long to wait for the server to START our request (it has one slot). */
  queueTimeoutMs: number;
  /** Longest silence tolerated once the server is working on our request. */
  silenceTimeoutMs: number;
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type QwenErrorCode =
  | 'CANCELLED'
  | 'AUTH_FAILED'
  | 'CONTEXT_OVERFLOW'
  | 'MODEL_LOADING'
  | 'SERVER_UNAVAILABLE'
  | 'QUEUE_TIMEOUT'
  | 'INACTIVITY_TIMEOUT'
  | 'PARSE_ERROR'
  | 'RUNTIME_FAILED'
  | 'HTTP_ERROR';

export class QwenError extends Error {
  constructor(public readonly code: QwenErrorCode, detail: string) {
    // The "CODE: detail" form is the wire format the renderer classifies on.
    super(`${code}: ${detail}`);
    this.name = 'QwenError';
  }
}

export interface QwenStats {
  promptTokens?: number;
  cachedTokens?: number;
  promptMs?: number;
  promptTokensPerSecond?: number;
  generatedTokens?: number;
  generationMs?: number;
  generationTokensPerSecond?: number;
}

export type QwenStreamEvent =
  | { type: 'phase'; phase: 'queued' | 'prompt-evaluating' }
  | { type: 'progress'; processed: number; total: number; cached: number; elapsedMs: number }
  | { type: 'token'; token: string }
  | { type: 'stats'; stats: QwenStats }
  | { type: 'truncated'; maxTokens: number }
  | { type: 'done' }
  | { type: 'error'; code: QwenErrorCode; error: string };

export interface StreamResult {
  text: string;
  finishReason: string | null;
  stats: QwenStats | null;
}

function headers(apiKey: string): Record<string, string> {
  return { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) };
}

/** `http://127.0.0.1:8080/v1` → `http://127.0.0.1:8080` (llama.cpp's /health, /props, /slots live at the root). */
export function serverRoot(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
}

/** Map an HTTP error body from llama.cpp (or any OpenAI-compatible server) to a code. */
export function classifyHttpError(status: number, body: string): QwenError {
  let message = body.trim();
  let type = '';
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; type?: string } | string; message?: string };
    const err = typeof parsed.error === 'object' ? parsed.error : undefined;
    message = err?.message ?? (typeof parsed.error === 'string' ? parsed.error : parsed.message) ?? message;
    type = err?.type ?? '';
  } catch {
    /* plain text body */
  }
  const short = message.slice(0, 300);
  if (status === 401 || status === 403) return new QwenError('AUTH_FAILED', 'The inference server rejected the configured credential.');
  if (type === 'exceed_context_size_error' || /exceeds the available context size|larger than the max context size/i.test(message)) {
    return new QwenError('CONTEXT_OVERFLOW', short);
  }
  if (status === 503 && /loading/i.test(message)) return new QwenError('MODEL_LOADING', 'The model is still loading into memory.');
  return new QwenError('HTTP_ERROR', `HTTP ${status}${short ? `: ${short}` : ''}`);
}

function numberOr(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** llama.cpp `timings` → stats. */
export function statsFromTimings(timings: Record<string, unknown> | undefined): QwenStats | null {
  if (!timings) return null;
  const stats: QwenStats = {
    promptTokens: numberOr(timings.prompt_n),
    cachedTokens: numberOr(timings.cache_n),
    promptMs: numberOr(timings.prompt_ms),
    promptTokensPerSecond: numberOr(timings.prompt_per_second),
    generatedTokens: numberOr(timings.predicted_n),
    generationMs: numberOr(timings.predicted_ms),
    generationTokensPerSecond: numberOr(timings.predicted_per_second)
  };
  return Object.values(stats).some((v) => v !== undefined) ? stats : null;
}

/**
 * Stream one chat completion. Resolves with the full text; rejects with a
 * QwenError. Events are emitted as they happen; `done` / `error` are NOT
 * emitted here — the caller owns the terminal event so it can add context.
 */
export async function streamChatCompletion(
  config: QwenClientConfig,
  messages: ChatMessage[],
  options: {
    signal?: AbortSignal;
    maxTokens?: number;
    temperature?: number;
    /** false forces a full prompt evaluation (used to measure real prompt speed). */
    cachePrompt?: boolean;
    /** Delay before reporting "queued" when the server has not started the request (default 2.5 s). */
    queuedNoticeMs?: number;
    onEvent?: (event: QwenStreamEvent) => void;
  } = {}
): Promise<StreamResult> {
  const emit = options.onEvent ?? (() => undefined);
  const maxTokens = options.maxTokens ?? config.maxOutputTokens;
  const controller = new AbortController();
  let reason: 'queue' | 'silence' | null = null;
  const onOuterAbort = () => controller.abort();
  if (options.signal?.aborted) throw new QwenError('CANCELLED', 'The inference request was cancelled.');
  options.signal?.addEventListener('abort', onOuterAbort, { once: true });

  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = (ms: number, why: 'queue' | 'silence') => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { reason = why; controller.abort(); }, ms);
  };
  // Tell the UI we are waiting on the server only if it does not start promptly.
  const queuedNotice = setTimeout(() => emit({ type: 'phase', phase: 'queued' }), options.queuedNoticeMs ?? 2500);

  try {
    arm(config.queueTimeoutMs, 'queue');
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: headers(config.apiKey),
        body: JSON.stringify({
          model: config.modelName,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: maxTokens,
          stream: true,
          // llama.cpp: keep the prompt prefix cached between turns, and stream
          // prompt-evaluation progress so a long prompt is visibly alive.
          cache_prompt: options.cachePrompt ?? true,
          return_progress: true,
          chat_template_kwargs: { enable_thinking: false }
        }),
        signal: controller.signal
      });
    } catch (error) {
      throw abortOrNetworkError(error, reason, config, options.signal);
    }
    clearTimeout(queuedNotice);

    if (!response.ok) {
      let body = '';
      try { body = await response.text(); } catch { /* ignore */ }
      throw classifyHttpError(response.status, body);
    }
    const reader = (response.body as ReadableStream<Uint8Array> | null)?.getReader();
    if (!reader) throw new QwenError('HTTP_ERROR', 'The inference server did not return a readable stream.');

    // Headers mean the server has started our request (llama.cpp sends them
    // when the slot begins processing the prompt).
    emit({ type: 'phase', phase: 'prompt-evaluating' });
    arm(config.silenceTimeoutMs, 'silence');

    let text = '';
    let finishReason: string | null = null;
    let stats: QwenStats | null = null;
    let sawDone = false;
    const parser = createSseDataParser((data) => {
      if (data === '[DONE]') { sawDone = true; return; }
      let chunk: Record<string, any>;
      try {
        chunk = JSON.parse(data);
      } catch (error) {
        throw new QwenError('PARSE_ERROR', error instanceof Error ? error.message : 'Unreadable stream frame.');
      }
      if (chunk.error) {
        const err = chunk.error as { message?: string; type?: string; code?: number };
        throw classifyHttpError(Number(err.code) || 500, JSON.stringify({ error: err }));
      }
      const progress = chunk.prompt_progress as Record<string, unknown> | undefined;
      if (progress) {
        emit({
          type: 'progress',
          processed: Number(progress.processed) || 0,
          total: Number(progress.total) || 0,
          cached: Number(progress.cache) || 0,
          elapsedMs: Number(progress.time_ms) || 0
        });
      }
      const choice = chunk.choices?.[0];
      const token = choice?.delta?.content;
      if (typeof token === 'string' && token) {
        text += token;
        emit({ type: 'token', token });
      }
      if (choice?.finish_reason) finishReason = String(choice.finish_reason);
      // llama.cpp attaches `timings` to the final frame; keep the latest seen.
      const timingStats = statsFromTimings(chunk.timings);
      if (timingStats) stats = timingStats;
    });

    while (true) {
      let part: Awaited<ReturnType<typeof reader.read>>;
      try {
        part = await reader.read();
      } catch (error) {
        throw abortOrNetworkError(error, reason, config, options.signal);
      }
      if (part.done) break;
      // Any bytes — including llama.cpp's ": ping" keep-alive — prove the
      // server is still working on this request.
      arm(config.silenceTimeoutMs, 'silence');
      parser.push(part.value);
      if (sawDone) break;
    }
    parser.finish();
    if (!sawDone && !finishReason) {
      throw new QwenError('HTTP_ERROR', 'The stream ended before the model finished.');
    }
    if (stats) emit({ type: 'stats', stats });
    if (finishReason === 'length') emit({ type: 'truncated', maxTokens });
    return { text, finishReason, stats };
  } finally {
    clearTimeout(queuedNotice);
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener('abort', onOuterAbort);
  }
}

function abortOrNetworkError(error: unknown, reason: 'queue' | 'silence' | null, config: QwenClientConfig, outer?: AbortSignal): QwenError {
  if (error instanceof QwenError) return error;
  if (outer?.aborted) return new QwenError('CANCELLED', 'The inference request was cancelled.');
  if (reason === 'queue') {
    return new QwenError('QUEUE_TIMEOUT', `The server did not start this request within ${Math.round(config.queueTimeoutMs / 1000)}s. It may be busy with another request or still loading.`);
  }
  if (reason === 'silence') {
    return new QwenError('INACTIVITY_TIMEOUT', `The server sent nothing for ${Math.round(config.silenceTimeoutMs / 1000)}s.`);
  }
  const cause = (error as { cause?: unknown } | null)?.cause;
  const detail = cause instanceof Error ? cause.message : error instanceof Error ? error.message : 'Unknown network error.';
  return new QwenError('SERVER_UNAVAILABLE', `Could not reach the model at ${config.baseUrl} (${detail}).`);
}

// ── Prompt budgeting ─────────────────────────────────────────────────────────

/**
 * Conservative token estimate for Qwen's tokenizer: ~3.2 characters per token
 * for English/JSON, plus per-message chat-template overhead. Over-estimating
 * is the safe direction — it trims history a little early instead of letting
 * the server reject the prompt.
 */
export function estimateTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, m) => total + Math.ceil(m.content.length / 3.2) + 8, 16);
}

/**
 * Keep a chat inside `budgetTokens`: drop the oldest history (never the system
 * message or the final user turn); if that is not enough, shorten the longest
 * remaining message from its middle. Returns what was removed so the caller can
 * tell the user.
 */
export function fitMessagesToContext(messages: ChatMessage[], budgetTokens: number): { messages: ChatMessage[]; droppedMessages: number; trimmedChars: number } {
  let out = [...messages];
  let droppedMessages = 0;
  const firstHistory = out[0]?.role === 'system' ? 1 : 0;
  while (estimateTokens(out) > budgetTokens && out.length - firstHistory > 1) {
    out.splice(firstHistory, 1);
    droppedMessages += 1;
  }
  let trimmedChars = 0;
  let guard = 0;
  while (estimateTokens(out) > budgetTokens && guard++ < 8) {
    const overChars = Math.ceil((estimateTokens(out) - budgetTokens) * 3.2) + 200;
    let longest = 0;
    out.forEach((m, i) => { if (m.content.length > out[longest].content.length) longest = i; });
    const content = out[longest].content;
    if (content.length <= 400) break;
    const cut = Math.min(content.length - 400, overChars);
    const keepHead = Math.floor((content.length - cut) * 0.6);
    const keepTail = content.length - cut - keepHead;
    out = out.map((m, i) => i === longest
      ? { ...m, content: `${content.slice(0, keepHead)}\n[… ${cut} characters omitted to fit the model's context …]\n${content.slice(content.length - keepTail)}` }
      : m);
    trimmedChars += cut;
  }
  return { messages: out, droppedMessages, trimmedChars };
}

// ── Server facts ─────────────────────────────────────────────────────────────

export interface ServerProps {
  nCtx?: number;
  buildInfo?: string;
  modelPath?: string;
}

/** llama.cpp `/props` (context size, build). Null for servers that do not expose it. */
export async function fetchServerProps(config: Pick<QwenClientConfig, 'baseUrl' | 'apiKey'>, timeoutMs = 3000): Promise<ServerProps | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${serverRoot(config.baseUrl)}/props`, { headers: headers(config.apiKey), signal: controller.signal });
    if (!response.ok) return null;
    const props = await response.json() as Record<string, any>;
    const nCtx = numberOr(props.default_generation_settings?.n_ctx) ?? numberOr(props.n_ctx);
    return { nCtx, buildInfo: typeof props.build_info === 'string' ? props.build_info : undefined, modelPath: typeof props.model_path === 'string' ? props.model_path : undefined };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
