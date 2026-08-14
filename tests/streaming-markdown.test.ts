import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownStreamCache, updateMarkdownStream } from '../src/streamingMarkdown.ts';

test('incrementally parses structured markdown across single-character chunks', () => {
  const source = [
    '## Plan',
    '1. **Inspect** `config`',
    '2. Validate output',
    '',
    '```',
    'status ok',
    '```'
  ].join('\n');
  let cache = createMarkdownStreamCache();

  for (let index = 1; index <= source.length; index += 1) {
    const result = updateMarkdownStream(cache, source.slice(0, index), index === source.length);
    cache = result.cache;
  }

  const result = updateMarkdownStream(cache, source, true);
  assert.equal(result.blocks.length, 3);
  assert.deepEqual(result.blocks.map((block) => block.type), ['heading', 'ordered-list', 'code']);
  assert.equal(result.blocks[0]?.text, 'Plan');
  assert.deepEqual(result.blocks[1]?.items, ['**Inspect** `config`', 'Validate output']);
  assert.equal(result.blocks[2]?.text, 'status ok');
});

test('does not reparse an unfinished line for every arriving token', () => {
  const cache = createMarkdownStreamCache();
  const first = updateMarkdownStream(cache, 'partial', false);
  const second = updateMarkdownStream(first.cache, 'partial response', false);

  assert.equal(first.cache.parsedLength, 0);
  assert.equal(second.cache.parsedLength, 0);
  assert.equal(second.blocks.at(-1)?.pending, true);

  const stable = updateMarkdownStream(second.cache, 'partial response\n', false);
  assert.equal(stable.cache.parsedLength, 'partial response\n'.length);
  assert.equal(stable.blocks[0]?.text, 'partial response');
});
