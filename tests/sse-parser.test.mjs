import assert from 'node:assert/strict';
import test from 'node:test';
import { createSseDataParser } from '../dist-electron/electron/sseParser.js';

const encoder = new TextEncoder();
const contentFrame = 'data: {"choices":[{"delta":{"content":"A💡"}}]}\n\n';
const doneFrame = 'data: [DONE]\n\n';

test('parses SSE frames split at every byte boundary', () => {
  const values = [];
  const parser = createSseDataParser((data) => values.push(data));
  const bytes = encoder.encode(`${contentFrame}${doneFrame}`);

  for (const byte of bytes) parser.push(Uint8Array.of(byte));
  parser.finish();

  assert.deepEqual(values, [
    '{"choices":[{"delta":{"content":"A💡"}}]}',
    '[DONE]'
  ]);
  assert.equal(JSON.parse(values[0]).choices[0].delta.content, 'A💡');
});

test('parses multiple complete events delivered in one chunk', () => {
  const values = [];
  const parser = createSseDataParser((data) => values.push(data));

  parser.push(encoder.encode(`${contentFrame}${doneFrame}`));
  parser.finish();

  assert.equal(values.length, 2);
  assert.equal(values[1], '[DONE]');
});
