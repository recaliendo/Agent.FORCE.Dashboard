import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifyHttpError, estimateTokens, fetchServerProps, fitMessagesToContext, QwenError, streamChatCompletion
} from '../dist-electron/electron/qwenClient.js';
import { getQwenConfig } from '../dist-electron/electron/qwenConfig.js';
import { readLogTail, redact, runQwenDoctor } from '../dist-electron/electron/qwenDoctor.js';

// A scripted stand-in for llama.cpp's server. Each test supplies how
// /v1/chat/completions behaves; /health, /props and /v1/models are fixed.
async function fakeServer(handleChat) {
  const server = createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"status":"ok"}'); return; }
    if (req.url === '/props') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ default_generation_settings: { n_ctx: 8192 }, build_info: 'b-test' })); return; }
    if (req.url === '/slots') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('[{"id":0,"is_processing":false}]'); return; }
    if (req.url === '/v1/models') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"data":[{"id":"Qwen/test"}]}'); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    req.body = JSON.parse(body || '{}');
    await handleChat(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { baseUrl: `http://127.0.0.1:${port}/v1`, close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }) };
}

const sse = (res) => res.writeHead(200, { 'Content-Type': 'text/event-stream' });
const frame = (res, obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
const token = (text) => ({ choices: [{ index: 0, finish_reason: null, delta: { content: text } }] });
const finish = (reason, timings) => ({ choices: [{ index: 0, finish_reason: reason, delta: {} }], ...(timings ? { timings } : {}) });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cfg = (baseUrl, extra = {}) => ({ baseUrl, apiKey: '', modelName: 'Qwen/test', maxOutputTokens: 64, queueTimeoutMs: 5000, silenceTimeoutMs: 400, ...extra });

test('streams tokens, asks for progress + prompt cache, and reports timings', async () => {
  let seenBody;
  const srv = await fakeServer(async (req, res) => {
    seenBody = req.body;
    sse(res);
    frame(res, token('Hello'));
    frame(res, token(' world'));
    frame(res, finish('stop', { prompt_n: 12, cache_n: 100, prompt_ms: 80, prompt_per_second: 150, predicted_n: 2, predicted_per_second: 30 }));
    res.end('data: [DONE]\n\n');
  });
  try {
    const events = [];
    const result = await streamChatCompletion(cfg(srv.baseUrl), [{ role: 'user', content: 'hi' }], { onEvent: (e) => events.push(e) });
    assert.equal(result.text, 'Hello world');
    assert.equal(result.finishReason, 'stop');
    assert.deepEqual(result.stats, { promptTokens: 12, cachedTokens: 100, promptMs: 80, promptTokensPerSecond: 150, generatedTokens: 2, generationMs: undefined, generationTokensPerSecond: 30 });
    assert.equal(seenBody.return_progress, true);
    assert.equal(seenBody.cache_prompt, true);
    assert.deepEqual(seenBody.chat_template_kwargs, { enable_thinking: false });
    assert.deepEqual(events.map((e) => e.type), ['phase', 'token', 'token', 'stats']);
  } finally { await srv.close(); }
});

test('a long prompt read stays alive on progress frames even when no text arrives for longer than the silence limit', async () => {
  const srv = await fakeServer(async (_req, res) => {
    sse(res);
    for (let i = 1; i <= 5; i++) {
      await sleep(200); // each gap < 400 ms limit, total 1 s > limit
      frame(res, { choices: [{ index: 0, finish_reason: null, delta: { role: 'assistant', content: null } }], prompt_progress: { total: 5000, cache: 0, processed: i * 1000, time_ms: i * 200 } });
    }
    frame(res, token('Done'));
    frame(res, finish('stop'));
    res.end('data: [DONE]\n\n');
  });
  try {
    const progress = [];
    const result = await streamChatCompletion(cfg(srv.baseUrl), [{ role: 'user', content: 'long' }], { onEvent: (e) => { if (e.type === 'progress') progress.push(e.processed); } });
    assert.equal(result.text, 'Done');
    assert.deepEqual(progress, [1000, 2000, 3000, 4000, 5000]);
  } finally { await srv.close(); }
});

test("llama.cpp's ': ping' keep-alive counts as a sign of life", async () => {
  const srv = await fakeServer(async (_req, res) => {
    sse(res);
    for (let i = 0; i < 4; i++) { await sleep(200); res.write(':\n\n'); }
    frame(res, token('ok'));
    frame(res, finish('stop'));
    res.end('data: [DONE]\n\n');
  });
  try {
    const result = await streamChatCompletion(cfg(srv.baseUrl), [{ role: 'user', content: 'x' }]);
    assert.equal(result.text, 'ok');
  } finally { await srv.close(); }
});

test('real silence beyond the limit is INACTIVITY_TIMEOUT', async () => {
  const srv = await fakeServer(async (_req, res) => { sse(res); frame(res, token('a')); await sleep(1500); res.end(); });
  try {
    await assert.rejects(streamChatCompletion(cfg(srv.baseUrl), [{ role: 'user', content: 'x' }]), (e) => e instanceof QwenError && e.code === 'INACTIVITY_TIMEOUT');
  } finally { await srv.close(); }
});

test('waiting for a busy single slot reports "queued", then QUEUE_TIMEOUT if it never starts', async () => {
  const srv = await fakeServer(async (_req, res) => { await sleep(1200); sse(res); res.end('data: [DONE]\n\n'); });
  try {
    const phases = [];
    await assert.rejects(
      streamChatCompletion(cfg(srv.baseUrl, { queueTimeoutMs: 600 }), [{ role: 'user', content: 'x' }], { queuedNoticeMs: 100, onEvent: (e) => { if (e.type === 'phase') phases.push(e.phase); } }),
      (e) => e instanceof QwenError && e.code === 'QUEUE_TIMEOUT'
    );
    assert.deepEqual(phases, ['queued']);
  } finally { await srv.close(); }
});

test('a queued request that does start completes normally', async () => {
  const srv = await fakeServer(async (_req, res) => { await sleep(300); sse(res); frame(res, token('late')); frame(res, finish('stop')); res.end('data: [DONE]\n\n'); });
  try {
    const phases = [];
    const r = await streamChatCompletion(cfg(srv.baseUrl), [{ role: 'user', content: 'x' }], { queuedNoticeMs: 50, onEvent: (e) => { if (e.type === 'phase') phases.push(e.phase); } });
    assert.equal(r.text, 'late');
    assert.deepEqual(phases, ['queued', 'prompt-evaluating']);
  } finally { await srv.close(); }
});

test('an answer cut off at max_tokens is reported as truncated', async () => {
  const srv = await fakeServer(async (_req, res) => { sse(res); frame(res, token('partial')); frame(res, finish('length')); res.end('data: [DONE]\n\n'); });
  try {
    const events = [];
    await streamChatCompletion(cfg(srv.baseUrl), [{ role: 'user', content: 'x' }], { maxTokens: 7, onEvent: (e) => events.push(e) });
    assert.deepEqual(events.find((e) => e.type === 'truncated'), { type: 'truncated', maxTokens: 7 });
  } finally { await srv.close(); }
});

test('HTTP errors map to specific codes, not "server unavailable"', async () => {
  const cases = [
    [400, { error: { code: 400, message: 'request (17013 tokens) exceeds the available context size (8192 tokens), try increasing it', type: 'exceed_context_size_error' } }, 'CONTEXT_OVERFLOW'],
    [503, { error: { code: 503, message: 'Loading model', type: 'unavailable_error' } }, 'MODEL_LOADING'],
    [401, { error: { code: 401, message: 'Invalid API Key', type: 'authentication_error' } }, 'AUTH_FAILED'],
    [500, { error: { code: 500, message: 'boom', type: 'server_error' } }, 'HTTP_ERROR']
  ];
  for (const [status, body, code] of cases) {
    const srv = await fakeServer(async (_req, res) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); });
    try {
      await assert.rejects(streamChatCompletion(cfg(srv.baseUrl), [{ role: 'user', content: 'x' }]), (e) => e instanceof QwenError && e.code === code, `HTTP ${status}`);
    } finally { await srv.close(); }
  }
  assert.match(classifyHttpError(400, '{"error":{"message":"request (9000 tokens) exceeds the available context size (8192 tokens)","type":"exceed_context_size_error"}}').message, /^CONTEXT_OVERFLOW: request \(9000 tokens\)/);
});

test('an error frame mid-stream is classified, and an unreachable server is SERVER_UNAVAILABLE', async () => {
  const srv = await fakeServer(async (_req, res) => { sse(res); frame(res, token('a')); frame(res, { error: { code: 500, message: 'slot crashed', type: 'server_error' } }); res.end(); });
  try {
    await assert.rejects(streamChatCompletion(cfg(srv.baseUrl), [{ role: 'user', content: 'x' }]), (e) => e.code === 'HTTP_ERROR' && /slot crashed/.test(e.message));
  } finally { await srv.close(); }
  await assert.rejects(streamChatCompletion(cfg('http://127.0.0.1:1/v1'), [{ role: 'user', content: 'x' }]), (e) => e.code === 'SERVER_UNAVAILABLE' && /127\.0\.0\.1:1/.test(e.message));
});

test('cancelling mid-read is CANCELLED', async () => {
  const srv = await fakeServer(async (_req, res) => { sse(res); await sleep(2000); res.end(); });
  try {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 150);
    await assert.rejects(streamChatCompletion(cfg(srv.baseUrl, { silenceTimeoutMs: 5000 }), [{ role: 'user', content: 'x' }], { signal: ac.signal }), (e) => e.code === 'CANCELLED');
  } finally { await srv.close(); }
});

test('fitMessagesToContext drops the oldest turns first and never the system prompt or the question', () => {
  const sys = { role: 'system', content: 'S'.repeat(300) };
  const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i} `.repeat(200) }));
  const question = { role: 'user', content: 'What now?' };
  const all = [sys, ...history, question];
  const budget = estimateTokens([sys, ...history.slice(-2), question]);
  const fitted = fitMessagesToContext(all, budget);
  assert.equal(fitted.messages[0], sys);
  assert.equal(fitted.messages.at(-1), question);
  assert.equal(fitted.droppedMessages, 8);
  assert.ok(estimateTokens(fitted.messages) <= budget);
  // A single oversized message is shortened from the middle, with a marker.
  const huge = fitMessagesToContext([sys, { role: 'user', content: 'x'.repeat(40000) }], 1000);
  assert.ok(estimateTokens(huge.messages) <= 1000);
  assert.match(huge.messages[1].content, /characters omitted to fit the model's context/);
});

test('config: the old 10 s / 30 s timeouts are corrected; explicit larger values are kept', () => {
  const legacy = getQwenConfig({ LLM_INFERENCE_CONNECT_TIMEOUT_SECONDS: '10', LLM_INFERENCE_INACTIVITY_TIMEOUT_SECONDS: '30' });
  assert.equal(legacy.queueTimeoutMs, 180_000);
  assert.equal(legacy.silenceTimeoutMs, 90_000);
  const custom = getQwenConfig({ LLM_QUEUE_TIMEOUT_SECONDS: '300', LLM_INFERENCE_INACTIVITY_TIMEOUT_SECONDS: '200' });
  assert.equal(custom.queueTimeoutMs, 300_000);
  assert.equal(custom.silenceTimeoutMs, 200_000);
  assert.equal(getQwenConfig({}).baseUrl, 'http://127.0.0.1:8080/v1');
});

test('fetchServerProps reads the context size; doctor passes on a healthy server', async () => {
  const srv = await fakeServer(async (req, res) => {
    sse(res);
    if (req.body.return_progress) frame(res, { choices: [{ index: 0, delta: {} }], prompt_progress: { total: 900, cache: 0, processed: 900, time_ms: 5 } });
    frame(res, token('OK'));
    frame(res, finish('stop', req.body.cache_prompt === false
      ? { prompt_n: 900, cache_n: 0, prompt_ms: 3000, prompt_per_second: 300, predicted_n: 4, predicted_per_second: 35 }
      : { prompt_n: 1, cache_n: 899, prompt_ms: 10, prompt_per_second: 100, predicted_n: 4, predicted_per_second: 35 }));
    res.end('data: [DONE]\n\n');
  });
  try {
    assert.equal((await fetchServerProps({ baseUrl: srv.baseUrl, apiKey: '' })).nCtx, 8192);
    const report = await runQwenDoctor({ client: cfg(srv.baseUrl, { silenceTimeoutMs: 5000 }) });
    assert.equal(report.verdict, 'pass', JSON.stringify(report.checks, null, 1));
    assert.equal(report.measurements.promptTokensPerSecond, 300);
    assert.equal(report.measurements.cachedTokenShare, 100);
    assert.match(report.summary, /reads 300 tokens\/s, writes 35 tokens\/s/);

    const quick = await runQwenDoctor({ client: cfg(srv.baseUrl), quick: true });
    assert.equal(quick.verdict, 'pass');
    assert.equal(quick.checks.some((c) => c.id === 'speed'), false);
    assert.equal(quick.summary, 'Qwen is reachable and configured correctly (speed not measured).');
  } finally { await srv.close(); }
});

test('doctor: unreachable server fails with a remedy; runtime log causes are recognised and secrets redacted', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'qwen-doctor-'));
  try {
    const log = path.join(dir, 'llama-server.log');
    writeFileSync(log, [
      'main: llama-server --api-key 0123456789abcdef0123456789abcdef',
      'E cudaMalloc failed: out of memory',
      'E llama_model_load: error loading model: unable to allocate CUDA0 buffer',
      'I Authorization: Bearer sk-FAKE-for-tests-only'
    ].join('\n'));
    const report = await runQwenDoctor({
      client: cfg('http://127.0.0.1:1/v1'),
      runtime: { autostart: true, running: false, serverPath: path.join(dir, 'nope.exe'), modelPath: path.join(dir, 'nope.gguf'), logPath: log }
    });
    assert.equal(report.verdict, 'fail');
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    assert.equal(byId['runtime-files'].status, 'fail');
    assert.equal(byId.reachable.status, 'fail');
    const logChecks = report.checks.filter((c) => c.label === 'Runtime log');
    assert.equal(logChecks.length, 1, 'one cause, attributed once');
    assert.match(logChecks[0].detail, /GPU ran out of memory/);
    const joined = report.logTail.join('\n');
    assert.doesNotMatch(joined, /0123456789abcdef0123456789abcdef|sk-FAKE-for-tests-only/);
    assert.match(joined, /--api-key \[redacted\]/);
    assert.match(joined, /Bearer \[redacted\]/);
    assert.deepEqual(readLogTail(path.join(dir, 'missing.log')), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('redact masks keys, bearer tokens and long hex strings', () => {
  assert.equal(redact('--api-key-file C:\\secrets\\k.txt'), '--api-key-file [redacted]');
  assert.equal(redact('api_key=FAKE-for-tests-only'), 'api_key=[redacted]');
  assert.equal(redact('token ghp_FAKE_for_tests_only end'), 'token [redacted] end');
  assert.equal(redact('ordinary log line'), 'ordinary log line');
});
