import type { QwenClientConfig } from './qwenClient.js';

/**
 * Qwen/LLM settings from the environment (`.env`). Kept free of Electron
 * imports so `scripts/qwen-doctor.mjs` reads exactly what the app reads.
 *
 * Timeout semantics, corrected after measuring llama.cpp's server:
 *
 * - The server sends HTTP headers only when its single slot STARTS our
 *   request. Waiting for headers therefore means "queued behind another
 *   request or still loading", not "connecting". The old 10 s
 *   LLM_INFERENCE_CONNECT_TIMEOUT_SECONDS killed any request that queued for
 *   more than 10 s and reported it as "server unavailable". The queue window
 *   is now LLM_QUEUE_TIMEOUT_SECONDS (default 180 s); an explicitly larger
 *   legacy connect value is still honoured.
 * - Once started, the server can be silent while it reads the prompt: it
 *   emits progress per ~2,048-token batch and a keep-alive ping after 30 s of
 *   silence. A silence limit at or below 30 s races the ping, so
 *   LLM_INFERENCE_INACTIVITY_TIMEOUT_SECONDS is raised to at least 90 s
 *   (default 120 s). It now measures silence, not "no visible token".
 */

export interface QwenRuntimeConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  /** Health/probe requests. */
  timeoutMs: number;
  maxOutputTokens: number;
  queueTimeoutMs: number;
  silenceTimeoutMs: number;
}

function seconds(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getQwenConfig(env: Record<string, string | undefined> = process.env): QwenRuntimeConfig {
  const baseUrl = (env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1').replace(/\/+$/, '');
  const apiKey = env.LLM_API_KEY || env.LLAMA_API_KEY || '';
  const modelName = env.LLM_MODEL_NAME || 'Qwen/Qwen3.6-35B-A3B';
  const maxOutput = Number(env.LLM_MAX_OUTPUT_TOKENS || '512');
  const queueSeconds = Math.max(seconds(env.LLM_QUEUE_TIMEOUT_SECONDS) ?? 180, seconds(env.LLM_INFERENCE_CONNECT_TIMEOUT_SECONDS) ?? 0, 10);
  const silenceSeconds = Math.max(seconds(env.LLM_INFERENCE_INACTIVITY_TIMEOUT_SECONDS) ?? 120, 90);
  return {
    baseUrl,
    apiKey,
    modelName,
    timeoutMs: Math.max(1, seconds(env.LLM_TIMEOUT_SECONDS) ?? 5) * 1000,
    maxOutputTokens: Number.isFinite(maxOutput) ? Math.min(4096, Math.max(64, Math.floor(maxOutput))) : 512,
    queueTimeoutMs: queueSeconds * 1000,
    silenceTimeoutMs: silenceSeconds * 1000
  };
}

export function toClientConfig(config: QwenRuntimeConfig): QwenClientConfig {
  return {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    modelName: config.modelName,
    maxOutputTokens: config.maxOutputTokens,
    queueTimeoutMs: config.queueTimeoutMs,
    silenceTimeoutMs: config.silenceTimeoutMs
  };
}

/** Parse a `.env` file's text (no expansion; quotes stripped). Real env wins. */
export function applyDotEnv(text: string, env: Record<string, string | undefined> = process.env): void {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    const name = key.trim();
    const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (name && env[name] === undefined) env[name] = value;
  }
}
