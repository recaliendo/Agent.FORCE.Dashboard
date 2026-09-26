import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('Missing .env. Run npm run qwen:setup first.');
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [name, ...rest] = line.split('=');
    if (process.env[name] === undefined) {
      process.env[name] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

loadDotEnv();

const baseUrl = (process.env.BENCHMARK_BASE_URL || process.env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1').replace(/\/+$/, '');
const model = process.env.LLM_MODEL_NAME || 'Qwen/Qwen3.6-35B-A3B';
const apiKey = process.env.LLM_API_KEY || process.env.LLAMA_API_KEY || '';
const benchmarkContext = [
  'Agent FORCE is a desktop operations dashboard. The current project has one production deployment, one source repository,',
  'a deterministic readiness score, connector health observations, CI status, audit-gate status, route QA results, and an',
  'operator-reviewed action queue. Guidance must use only supplied facts, must distinguish missing evidence from failure,',
  'and must never claim that a deploy, configuration change, email, purchase, or external write occurred. The response should',
  'be concise, operational, and ordered by urgency. The model should not expose hidden reasoning or invent credentials.',
  'Stable context marker: standardcraft-benchmark-v1. '.repeat(8)
].join(' ');
const body = {
  model,
  messages: [
    { role: 'system', content: benchmarkContext },
    { role: 'user', content: 'Output the integers 1 through 100, separated by single spaces, with no introduction or conclusion.' }
  ],
  temperature: 0,
  max_tokens: 64,
  stream: false,
  cache_prompt: false,
  chat_template_kwargs: { enable_thinking: false }
};

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 300_000);
const startedAt = performance.now();

try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(body),
    signal: controller.signal
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Benchmark request returned HTTP ${response.status}: ${JSON.stringify(payload)}`);
  const timings = payload.timings ?? {};
  console.log(JSON.stringify({
    baseUrl,
    model,
    elapsedMs: Math.round(performance.now() - startedAt),
    promptTokens: timings.prompt_n,
    promptMs: timings.prompt_ms,
    promptTokensPerSecond: timings.prompt_per_second,
    generatedTokens: timings.predicted_n,
    generationMs: timings.predicted_ms,
    generationTokensPerSecond: timings.predicted_per_second,
    finishReason: payload.choices?.[0]?.finish_reason,
    contentPreview: String(payload.choices?.[0]?.message?.content ?? '').slice(0, 120)
  }, null, 2));
} finally {
  clearTimeout(timeout);
}
