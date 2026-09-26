import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('Missing .env. Run npm run qwen:setup first.');
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [name, ...rest] = line.split('=');
    if (process.env[name] === undefined) process.env[name] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
}

async function request(url, init, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      const detail = error?.name === 'AbortError'
        ? `Timed out after ${timeoutMs} ms`
        : 'The local Qwen server is not reachable';
      throw new Error(`${detail} at ${url}. Start it with scripts\\start-local-qwen.ps1, then run verification again.`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

loadDotEnv();
const baseUrl = (process.env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1').replace(/\/+$/, '');
const model = process.env.LLM_MODEL_NAME || 'Qwen/Qwen3.6-35B-A3B';
const apiKey = process.env.LLM_API_KEY || process.env.LLAMA_API_KEY || '';
const headers = {
  'Content-Type': 'application/json',
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
};

const startedAt = Date.now();
const modelsResponse = await request(`${baseUrl}/models`, { headers });
const modelsPayload = await modelsResponse.json();
if (!Array.isArray(modelsPayload.data)) throw new Error('/models did not return an OpenAI-compatible model list.');
console.log(`Health OK: ${baseUrl} (${Date.now() - startedAt} ms)`);

if (apiKey && new URL(baseUrl).hostname === '127.0.0.1') {
  const unauthenticated = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Auth probe' }], max_tokens: 1 })
  });
  if (unauthenticated.status !== 401) {
    throw new Error(`Local inference authentication is not enforced (expected HTTP 401, received ${unauthenticated.status}).`);
  }
  console.log('Authentication OK: unauthenticated inference rejected with HTTP 401');
}

const streamResponse = await request(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'Reply with one short sentence confirming Agent FORCE local inference is operational. /no_think' }],
    temperature: 0,
    max_tokens: 96,
    stream: true,
    chat_template_kwargs: { enable_thinking: false }
  })
}, 15000);

if (!streamResponse.body) throw new Error('Chat completion did not return a stream.');
const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let content = '';
let eventCount = 0;
let firstTokenMs = null;

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    const chunk = JSON.parse(data);
    const token = chunk?.choices?.[0]?.delta?.content;
    if (typeof token === 'string' && token) {
      if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
      eventCount += 1;
      content += token;
    }
  }
}

if (!content.trim()) throw new Error('Streaming completed without assistant content.');
if (eventCount < 2) throw new Error(`Streaming was buffered into ${eventCount} content event(s), not incremental.`);
console.log(`Streaming OK: first token ${firstTokenMs} ms, ${eventCount} content events`);
console.log(`Completion: ${content.trim()}`);
