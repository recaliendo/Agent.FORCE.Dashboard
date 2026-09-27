// Backend hardening: IPC input guards, the OFW privacy boundary, grounding,
// the OFW connector connection, the managed llama-server runtime, and slot
// release on failed streams. Runs against the compiled dist-electron output.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertOfwDestination, containsOfwRecords, isSafeExternalUrl, isTrustedSenderUrl, isValidRequestId, MAX_CHAT_MESSAGES, sanitizeChatMessages } from '../dist-electron/electron/ipcGuards.js';
import { isLoopbackBaseUrl } from '../dist-electron/electron/loopback.js';
import { buildChatContext, buildGroundedPrompt, coverageCaveats, excerptAround, groundingBudget } from '../dist-electron/electron/ofw-grounding.js';
import { connectorEnv, OfwConnection, StderrTail } from '../dist-electron/electron/ofw.js';
import { streamChatCompletion, QwenError } from '../dist-electron/electron/qwenClient.js';
import { ensureManagedLocalLlm, stopManagedLocalLlm } from '../dist-electron/electron/localLlmRuntime.js';
import { newestLog } from '../dist-electron/electron/qwenDoctor.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_CONNECTOR = path.join(here, 'fixtures', 'fake-ofw-connector.mjs');
const FAKE_LLAMA = path.join(here, 'fixtures', 'fake-llama-server.mjs');

// ── IPC guards ──────────────────────────────────────────────────────────────

test('request ids are short plain tokens', () => {
  assert.ok(isValidRequestId('qwen-1790000000000-a1b2'));
  for (const bad of ['', 'a'.repeat(101), '../x', 'id with space', 'x:y', 42, null, undefined]) assert.equal(isValidRequestId(bad), false, String(bad));
});

test('chat transcripts from the renderer are validated before they reach the model', () => {
  assert.deepEqual(sanitizeChatMessages([{ role: 'system', content: 's', extra: 1 }, { role: 'user', content: 'q' }]), [{ role: 'system', content: 's' }, { role: 'user', content: 'q' }]);
  assert.throws(() => sanitizeChatMessages([]), /at least one/);
  assert.throws(() => sanitizeChatMessages('hi'), /at least one/);
  assert.throws(() => sanitizeChatMessages([{ role: 'tool', content: 'x' }]), /invalid role/);
  assert.throws(() => sanitizeChatMessages([{ role: 'user' }]), /no text/);
  assert.throws(() => sanitizeChatMessages([null]), /invalid role/);
  assert.throws(() => sanitizeChatMessages(Array.from({ length: MAX_CHAT_MESSAGES + 1 }, () => ({ role: 'user', content: 'x' }))), /at most/);
  assert.throws(() => sanitizeChatMessages([{ role: 'user', content: 'x'.repeat(400_001) }]), /too large/);
});

test('only the app page may call IPC; only web and mail links leave the app', () => {
  const app = 'file:///C:/Agent/dist/index.html';
  assert.ok(isTrustedSenderUrl(app, app));
  assert.ok(isTrustedSenderUrl(`${app}#/projects/talentquest`, app));
  assert.equal(isTrustedSenderUrl('file:///C:/Users/evil.html', app), false);
  assert.equal(isTrustedSenderUrl('https://example.com/', app), false);
  assert.equal(isTrustedSenderUrl(undefined, app), false);
  assert.ok(isTrustedSenderUrl('http://127.0.0.1:5173/#/x', app, 'http://127.0.0.1:5173'));
  assert.equal(isTrustedSenderUrl('http://127.0.0.1:5174/', app, 'http://127.0.0.1:5173'), false);
  assert.ok(isSafeExternalUrl('https://github.com/x'));
  assert.ok(isSafeExternalUrl('mailto:a@b.c'));
  for (const bad of ['file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', 'ms-settings:', 'not a url', 42, `https://x.com/${'a'.repeat(2100)}`]) assert.equal(isSafeExternalUrl(bad), false, String(bad).slice(0, 40));
});

test('loopback detection covers every local form, and nothing else', () => {
  for (const url of ['http://127.0.0.1:8080/v1', 'http://127.4.5.6:1/v1', 'http://localhost:8080/v1', 'http://[::1]:8080/v1', 'http://LOCALHOST/v1']) assert.ok(isLoopbackBaseUrl(url), url);
  for (const url of ['http://192.168.1.5:8080/v1', 'https://api.example.com/v1', 'http://127.0.0.1.evil.com/v1', 'not a url']) assert.equal(isLoopbackBaseUrl(url), false, url);
});

test('OFW records never go to a remote model unless explicitly allowed', () => {
  const grounded = [{ role: 'user', content: 'OFW message excerpts retrieved for this question (read-only, ranked by relevance):\n[#1] …' }];
  const analysis = [{ role: 'system', content: 'You analyse OurFamilyWizard co-parenting messages for the account holder.' }];
  assert.ok(containsOfwRecords(grounded));
  assert.ok(containsOfwRecords(analysis));
  assert.equal(containsOfwRecords([{ role: 'user', content: 'Prioritize the next move' }]), false);
  assert.doesNotThrow(() => assertOfwDestination('http://127.0.0.1:8080/v1', false));
  assert.doesNotThrow(() => assertOfwDestination('http://[::1]:8080/v1', false));
  assert.throws(() => assertOfwDestination('https://api.example.com/v1', false), /^Error: REMOTE_MODEL_BLOCKED: .*api\.example\.com/);
  assert.throws(() => assertOfwDestination('garbage', false), /REMOTE_MODEL_BLOCKED/);
  assert.doesNotThrow(() => assertOfwDestination('https://api.example.com/v1', true));
});

// ── Grounding ───────────────────────────────────────────────────────────────

const hit = (id, sentAt, subject, body) => ({ source: { messageId: id, folder: 'inbox', subject, from: 'Jordan', to: ['Alex'], sentAt, sentAtDisplay: sentAt }, snippet: body.slice(0, 20), body });

test('a timeline is ordered by actual time, even across UTC offsets', () => {
  // 01:30 -05:00 (06:30Z) is later than 02:00 -04:00 (06:00Z), though it sorts first as text.
  const payload = { results: [hit(2, '2026-11-01T01:30:00-05:00', 'Later', 'later body'), hit(1, '2026-11-01T02:00:00-04:00', 'Earlier', 'earlier body')], complete: true };
  const { sources, messages } = buildGroundedPrompt('timeline', 'topic', payload, { maxMessages: 8, maxChars: 6000 });
  assert.deepEqual(sources.map((s) => s.messageId), [1, 2]);
  assert.ok(messages[1].content.indexOf('[#1]') < messages[1].content.indexOf('[#2]'));
});

test('grounded prompts carry citations, coverage limits and only valid sources', () => {
  const payload = { results: [hit(10, '2026-06-02T12:00:00-04:00', 'Dentist', 'Cleaning moved to June 18.'), { source: { messageId: 'x' } }], complete: false, returned: 1, totalMatches: 5 };
  const g = buildGroundedPrompt('answer', 'when is the cleaning?', payload, { maxMessages: 8, maxChars: 6000 });
  assert.equal(g.sources.length, 1);
  assert.match(g.messages[0].content, /\[#123\]/);
  assert.match(g.messages[1].content, /Question: when is the cleaning\?/);
  assert.match(g.messages[1].content, /\[#10\] .*Subject: Dentist/);
  assert.deepEqual(coverageCaveats(payload).length, 2);
  const chat = buildChatContext('q', { results: [] }, { maxMessages: 8, maxChars: 4500 });
  assert.match(chat.context, /No messages matched/);
});

test('excerpts centre on the match and budgets are clamped', () => {
  const body = `${'a '.repeat(600)}THE MATCHED PART ${'b '.repeat(600)}`;
  const ex = excerptAround(body, '«THE MATCHED» PART', 120);
  assert.ok(ex.includes('THE MATCHED PART'));
  assert.ok(ex.startsWith('… ') && ex.endsWith(' …'));
  assert.deepEqual(groundingBudget({}), { maxMessages: 8, maxChars: 6000 });
  assert.deepEqual(groundingBudget({ OFW_ANALYSIS_MAX_MESSAGES: '999', OFW_ANALYSIS_MAX_CHARS: '5' }), { maxMessages: 20, maxChars: 1500 });
  assert.deepEqual(groundingBudget({ OFW_ANALYSIS_MAX_MESSAGES: 'abc' }), { maxMessages: 8, maxChars: 6000 });
});

// ── OFW connector connection ────────────────────────────────────────────────

test('the connector gets no model secrets and is always forced read-only', () => {
  const env = connectorEnv({ PATH: '/bin', LLM_API_KEY: 'k', LLAMA_API_KEY: 'k2', LLM_BASE_URL: 'u', OFW_USERNAME: 'me', OFW_WRITE_MODE: 'all', UNDEF: undefined });
  assert.equal(env.PATH, '/bin');
  assert.equal(env.OFW_USERNAME, 'me');
  assert.equal(env.LLM_API_KEY, undefined);
  assert.equal(env.LLAMA_API_KEY, undefined);
  assert.equal(env.LLM_BASE_URL, undefined);
  assert.equal(env.OFW_WRITE_MODE, 'none');
  assert.equal(env.OFW_ALLOW_MARK_READ, 'false');
  assert.equal('UNDEF' in env, false);
});

test('the stderr tail is bounded, skips the banner and redacts secrets', () => {
  const tail = new StderrTail(3);
  tail.push('[ofw-mcp] This project was developed by AI\nline one\nline two\n');
  tail.push('Authorization: Bearer abcdefghijklmnop1234\npartial');
  tail.push(' end\n');
  tail.push('x\n'.repeat(10));
  assert.equal(tail.last(), 'x');
  const t2 = new StderrTail();
  t2.push('token ghp_FAKE_for_tests_only_000\n');
  assert.doesNotMatch(t2.last(), /ghp_FAKE/);
  assert.equal(new StderrTail().last(), undefined);
  for (const line of ['OFW_PASSWORD=hunter2secret', 'password: "hunter2secret"', 'login failed with password=hunter2secret (403)', '{"token":"hunter2secret"}', 'secret=hunter2secret']) {
    const t3 = new StderrTail();
    t3.push(`${line}\n`);
    assert.doesNotMatch(t3.last(), /hunter2secret/, line);
  }
});

function connectorConfig(dir) {
  const file = path.join(dir, 'ofw.local.json');
  writeFileSync(file, JSON.stringify({ nodePath: process.execPath, launcherPath: FAKE_CONNECTOR }));
  return file;
}

async function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

test('a connector that floods stderr keeps answering (the pipe is drained)', { timeout: 30000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ofw-conn-'));
  const conn = new OfwConnection(connectorConfig(dir));
  try {
    await withEnv({ FAKE_OFW_MODE: 'flood', LLM_API_KEY: 'secret-model-key' }, async () => {
      const first = await conn.request('messages', { size: 1 });
      const second = await conn.request('messages', { size: 1 });
      assert.equal(first.tool, 'ofw_list_messages');
      assert.equal(second.tool, 'ofw_list_messages');
      assert.equal(first.env.hasLlmKey, false, 'the connector must not receive the model key');
      assert.equal(first.env.writeMode, 'none');
    });
  } finally { await conn.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('a connector exposing write tools is refused with the real reason', { timeout: 20000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ofw-conn-'));
  const conn = new OfwConnection(connectorConfig(dir));
  try {
    await withEnv({ FAKE_OFW_MODE: 'write-tools' }, () =>
      assert.rejects(conn.request('connect', {}), /exposes write tools/));
  } finally { await conn.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('a connector that dies on start reports what it said, redacted', { timeout: 20000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ofw-conn-'));
  const conn = new OfwConnection(connectorConfig(dir));
  try {
    await withEnv({ FAKE_OFW_MODE: 'crash' }, async () => {
      const error = await conn.request('connect', {}).then(() => null, (e) => e);
      assert.ok(error, 'connect must fail');
      assert.match(error.message, /Could not start a verified read-only OFW connector/);
      assert.match(error.message, /login failed/);
      assert.doesNotMatch(error.message, /hunter2secret/);
      assert.doesNotMatch(error.message, /developed and is maintained by AI/);
    });
  } finally { await conn.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('a missing OFW configuration is explained', async () => {
  await assert.rejects(new OfwConnection('/nonexistent/ofw.local.json').request('connect', {}), /OFW is not configured/);
});

// ── Streaming slot release ──────────────────────────────────────────────────

test('a malformed stream frame closes the request so the single slot is freed', { timeout: 10000 }, async () => {
  let closed;
  const serverClosed = new Promise((r) => { closed = r; });
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: {not json\n\n');
    const keep = setInterval(() => res.write(': ping\n\n'), 50); // the "server" would keep generating
    res.on('close', () => { clearInterval(keep); closed(true); });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${srv.address().port}/v1`;
  try {
    await assert.rejects(
      streamChatCompletion({ baseUrl, apiKey: '', modelName: 'm', maxOutputTokens: 16, queueTimeoutMs: 5000, silenceTimeoutMs: 5000 }, [{ role: 'user', content: 'x' }]),
      (e) => e instanceof QwenError && e.code === 'PARSE_ERROR'
    );
    assert.equal(await Promise.race([serverClosed, new Promise((r) => setTimeout(() => r(false), 2000))]), true, 'the connection must be closed');
  } finally { srv.closeAllConnections(); srv.close(); }
});

// ── Managed llama-server runtime ────────────────────────────────────────────

async function freePort() {
  return new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
}

test('the managed server gets its key by environment, never on the command line, and startup waits through loading', { timeout: 30000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'llama-rt-'));
  const port = await freePort();
  const record = path.join(dir, 'launch.json');
  const model = path.join(dir, 'model.gguf');
  writeFileSync(model, 'gguf');
  try {
    await withEnv({
      LLAMA_SERVER_PATH: FAKE_LLAMA, LLAMA_MODEL_PATH: model, LLAMA_RUNTIME_ROOT: dir, LLAMA_API_KEY_FILE: path.join(dir, 'missing-key.txt'),
      LLAMA_LOG_PATH: path.join(dir, 'logs', 'llama-server.log'), FAKE_LLAMA_RECORD: record, FAKE_LOAD_MS: '1500', LLM_AUTOSTART: 'true', LLM_STARTUP_TIMEOUT_SECONDS: '20'
    }, async () => {
      await ensureManagedLocalLlm({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'sk-local-test-key-123', modelName: 'Qwen/Test' });
      const launch = JSON.parse(readFileSync(record, 'utf8'));
      assert.equal(launch.args.includes('--api-key'), false);
      assert.equal(launch.args.some((a) => a.includes('sk-local-test-key-123')), false, 'the key must not be on the command line');
      assert.equal(launch.envKey, 'sk-local-test-key-123');
      assert.deepEqual(launch.args.slice(launch.args.indexOf('--port'), launch.args.indexOf('--port') + 2), ['--port', String(port)]);
    });
  } finally { stopManagedLocalLlm(); rmSync(dir, { recursive: true, force: true }); }
});

test('a server already loading on the port is waited for, not treated as a failure', { timeout: 15000 }, async () => {
  const readyAt = Date.now() + 1200;
  const srv = http.createServer((req, res) => { const loading = Date.now() < readyAt; res.writeHead(loading ? 503 : 200); res.end(loading ? '{"error":{"message":"Loading model"}}' : '{"data":[]}'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    await withEnv({ LLM_AUTOSTART: 'true', LLAMA_SERVER_PATH: '/nonexistent/llama-server' }, () =>
      ensureManagedLocalLlm({ baseUrl: `http://127.0.0.1:${srv.address().port}/v1`, apiKey: '', modelName: 'm' }));
    assert.ok(Date.now() >= readyAt, 'returned only once the model had loaded');
  } finally { srv.close(); }
});

test('[::1] endpoints are treated as local by the runtime too', { timeout: 10000 }, async () => {
  // Autostart applies to [::1]; with nothing listening and no server binary, it must try to start (and say why it cannot).
  await withEnv({ LLM_AUTOSTART: 'true', LLAMA_SERVER_PATH: '/nonexistent/llama-server' }, () =>
    assert.rejects(ensureManagedLocalLlm({ baseUrl: 'http://[::1]:9/v1', apiKey: '', modelName: 'm' }), /Managed llama.cpp server is missing/));
});

test('the doctor reads whichever server log was written last', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'logs-'));
  try {
    const appLog = path.join(dir, 'llama-server.log');
    const startLog = path.join(dir, 'llama-server.stderr.log');
    assert.equal(newestLog(appLog), appLog, 'no logs yet: the configured path');
    writeFileSync(appLog, 'app');
    writeFileSync(startLog, 'qwen:start');
    const now = Date.now() / 1000;
    utimesSync(appLog, now - 100, now - 100);
    assert.equal(newestLog(appLog), startLog);
    utimesSync(startLog, now - 200, now - 200);
    assert.equal(newestLog(appLog), appLog);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
