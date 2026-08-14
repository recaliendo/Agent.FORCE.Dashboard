import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'));
  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1];
}

test('assistant output fills the transcript while user prompts remain bounded', () => {
  const assistant = rule('.qwen-assistant');
  const user = rule('.qwen-user');

  assert.match(assistant, /width:\s*100%/);
  assert.match(assistant, /max-width:\s*100%/);
  assert.match(assistant, /justify-self:\s*stretch/);
  assert.match(user, /max-width:\s*min\(76%,\s*72ch\)/);
});

test('assistant markdown can use the full message surface', () => {
  assert.match(
    styles,
    /\.qwen-assistant \.streaming-markdown,\s*\.qwen-assistant \.qwen-state-copy\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/s
  );
});
