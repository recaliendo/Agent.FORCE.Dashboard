import assert from 'node:assert/strict';
import test from 'node:test';
import { readRequest } from '../dist-electron/electron/ofw-policy.js';
import {
  buildChatContext, buildGroundedPrompt, buildSources, coverageCaveats, excerptAround, groundingBudget, isLoopbackBaseUrl
} from '../dist-electron/electron/ofw-grounding.js';
import { localNaturalSearch } from '../dist-electron/electron/ofw-nlp/search.js';

const hit = (id, body, extra = {}) => ({
  rank: id,
  source: { messageId: id, folder: 'inbox', subject: `Subject ${id}`, from: 'Sarah Jones', to: ['Richard'], sentAt: `2026-08-${String(id).padStart(2, '0')}T10:00:00-04:00`, sentAtDisplay: `Aug ${id}, 2026` },
  snippet: body ? body.slice(0, 60) : 'preview text',
  ...(body ? { body } : { bodySource: 'preview' }),
  ...extra
});

test('nlsearch policy maps a question to ofw_search_messages, read-only', () => {
  const req = readRequest('nlsearch', { query: ' what did she say about the dentist? ', folderId: 'inbox', since: '2026-08-01', limit: 10, includeBody: true });
  assert.equal(req.name, 'ofw_search_messages');
  assert.deepEqual(req.arguments, {
    query: 'what did she say about the dentist?', mode: 'natural', folderId: 'inbox', since: '2026-08-01', until: undefined, limit: 10, includeBody: true, autoRefresh: true
  });
});

test('nlsearch policy rejects bad input', () => {
  assert.throws(() => readRequest('nlsearch', { query: '   ' }), /Type what you are looking for/);
  assert.throws(() => readRequest('nlsearch', { query: 'x', mode: 'regex' }), /Invalid mode/);
  assert.throws(() => readRequest('nlsearch', { query: 'x', limit: 500 }), /Invalid limit/);
  assert.throws(() => readRequest('nlsearch', { query: 'x', since: '2026-09-01', until: '2026-08-01' }), /End date/);
  assert.throws(() => readRequest('nlsearch', { query: 'x'.repeat(501) }), /Invalid query/);
  // The old exact-match box accepted no more than 300 characters; a question gets 500.
  assert.equal(readRequest('nlsearch', { query: 'x'.repeat(500) }).arguments.query.length, 500);
});

test('excerptAround keeps the matched part of a long message', () => {
  const body = `${'intro '.repeat(200)}The copay was $40, please reimburse half. ${'outro '.repeat(200)}`;
  const out = excerptAround(body, '… The «copay» was $40, please «reimburse» half …', 200);
  assert.ok(out.includes('The copay was $40, please reimburse half.'), out);
  assert.ok(out.startsWith('… ') && out.endsWith(' …'));
  assert.ok(out.length <= 210);
  assert.equal(excerptAround('short  body\n text', 'x', 200), 'short body text');
});

test('buildSources respects the budget and marks preview-only messages', () => {
  const hits = [hit(1, 'a'.repeat(5000)), hit(2, null), hit(3, 'c'.repeat(5000))];
  const sources = buildSources(hits, { maxMessages: 2, maxChars: 1000 });
  assert.equal(sources.length, 2);
  assert.ok(sources[0].excerpt.length <= 510);
  assert.equal(sources[1].partial, true);
  assert.equal(sources[1].excerpt, 'preview text');
});

test('grounded prompt: excerpts are numbered, citations required, caveats carried', () => {
  const payload = { complete: false, returned: 2, totalMatches: 9, bodiesNote: 'x', results: [hit(2, 'Second message.'), hit(1, 'First message.')] };
  const { messages, sources, caveats } = buildGroundedPrompt('answer', 'when is pickup?', payload, { maxMessages: 8, maxChars: 6000 });
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /ONLY the numbered message excerpts/);
  assert.match(messages[0].content, /\[#123\]/);
  assert.match(messages[1].content, /Question: when is pickup\?/);
  assert.match(messages[1].content, /\[#2\] Aug 2, 2026 · From Sarah Jones to Richard · Subject: Subject 2\nSecond message\./);
  assert.deepEqual(sources.map((s) => s.messageId), [2, 1]);
  assert.equal(caveats.length, 3);
  assert.match(messages[1].content, /Only the 2 most relevant of 9 matching messages were read/);
});

test('timeline orders excerpts oldest first', () => {
  const payload = { complete: true, results: [hit(9, 'later'), hit(3, 'earlier')] };
  const { sources, messages } = buildGroundedPrompt('timeline', '', payload, { maxMessages: 8, maxChars: 6000 });
  assert.deepEqual(sources.map((s) => s.messageId), [3, 9]);
  assert.match(messages[1].content, /Topic: the retrieved messages/);
});

test('coverage caveats are empty for a complete, fully-read result', () => {
  assert.deepEqual(coverageCaveats({ complete: true, returned: 3, totalMatches: 3 }), []);
});

test('chat context carries excerpts and the citation rule, and says when nothing matched', () => {
  const { context } = buildChatContext('dentist', { complete: true, results: [hit(4, 'Dentist Tuesday.')] }, { maxMessages: 5, maxChars: 3000 });
  assert.match(context, /\[#4\]/);
  assert.match(context, /cite message numbers exactly like \[#123\]/);
  assert.match(buildChatContext('x', { complete: true, results: [] }, { maxMessages: 5, maxChars: 3000 }).context, /No messages matched/);
});

test('OFW content only goes to a loopback model', () => {
  for (const url of ['http://127.0.0.1:8080/v1', 'http://localhost:8080/v1', 'http://[::1]:8080/v1', 'http://127.1.2.3/v1']) assert.equal(isLoopbackBaseUrl(url), true, url);
  for (const url of ['https://api.openai.com/v1', 'http://192.168.1.5:8080/v1', 'http://127.0.0.1.evil.com/v1', 'not a url']) assert.equal(isLoopbackBaseUrl(url), false, url);
});

test('grounding budget reads env with sane bounds', () => {
  assert.deepEqual(groundingBudget({}), { maxMessages: 8, maxChars: 6000 });
  assert.deepEqual(groundingBudget({ OFW_ANALYSIS_MAX_MESSAGES: '50', OFW_ANALYSIS_MAX_CHARS: '10' }), { maxMessages: 20, maxChars: 1500 });
  assert.deepEqual(groundingBudget({ OFW_ANALYSIS_MAX_MESSAGES: 'abc' }), { maxMessages: 8, maxChars: 6000 });
});

const compact = (id, folder, subject, body, sentAt, from = 'Sarah Jones') => ({
  id, folder, subject, from, sentAt, sentAtDisplay: sentAt, recipients: [{ userId: 1, name: folder === 'sent' ? 'Sarah Jones' : 'Richard', viewedAt: null }], body
});

test('local fallback: a question is understood and ranked from ofw_list_messages pages', async () => {
  const calls = [];
  const pages = {
    1: { messages: [compact(1, 'inbox', 'Weekend', 'Can we move the exchange to 6 on Sunday?', '2026-08-20T09:00:00'), compact(2, 'inbox', 'Emma - teeth', 'Emma saw the dentist. The copay was $40, please reimburse half.', '2026-08-14T18:20:00')], nextPage: 2, freshness: { staleness: 'fresh', historyComplete: true } },
    2: { messages: [compact(3, 'sent', 'Re: teeth', 'I will reimburse you once I see the receipt.', '2026-08-15T08:00:00', 'Richard')], nextPage: null, freshness: { staleness: 'fresh', historyComplete: true } }
  };
  const callTool = async (name, args) => { calls.push({ name, args }); return pages[args.page]; };
  const out = await localNaturalSearch(callTool, { query: 'what did she say about paying for the dentsit?', includeBody: true }, new Date('2026-09-26T15:00:00Z'));
  assert.deepEqual(calls.map((c) => [c.name, c.args.page, c.args.folderId, c.args.view]), [['ofw_list_messages', 1, 'inbox', 'compact'], ['ofw_list_messages', 2, 'inbox', 'compact']]);
  assert.equal(out.engine, 'local');
  assert.equal(out.complete, true);
  assert.equal(out.results[0].source.messageId, 2);
  assert.match(out.results[0].snippet, /«dentist»/);
  assert.equal(out.results[0].body.includes('copay'), true);
  assert.equal(out.interpretation.folder, 'inbox');
  assert.deepEqual(out.interpretation.terms.find((t) => t.word === 'dentsit').spellingCorrectedTo, ['dentist']);
});

test('local fallback passes a refusal through as a non-answer', async () => {
  const out = await localNaturalSearch(async () => ({ result: 'UNVERIFIED_EMPTY', reason: 'stale', remedy: 'sync' }), { query: 'dentist' });
  assert.equal(out.result, 'UNVERIFIED_EMPTY');
  assert.equal(out.complete, false);
});

test('local fallback exact mode narrows with q and keeps the literal phrase', async () => {
  let seen;
  const out = await localNaturalSearch(async (_n, args) => { seen = args; return { messages: [compact(5, 'sent', 's', 'once I see the receipt', '2026-08-15T08:00:00')], nextPage: null, freshness: { staleness: 'stale', historyComplete: true } }; }, { query: 'once I see the receipt', mode: 'exact' });
  assert.equal(seen.q, 'once I see the receipt');
  assert.equal(out.results[0].snippet, '«once I see the receipt»');
  assert.equal(out.complete, false);
  assert.match(out.completeNote, /newer messages may exist/);
});
