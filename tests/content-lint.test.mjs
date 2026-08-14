import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { findViolations, lintApplication } from '../scripts/content-lint.mjs';

const protectedUrl = `https://github.com/caliendohomes-rgb/${['Job', 'SEARCH', 'AGENT'].join('.')}`;

test('repository.url is the sole narrow vocabulary exclusion', () => {
  const allowed = findViolations(`const project = { repository: { url: '${protectedUrl}', label: 'Halo Portfolio Agent' } };`);
  assert.equal(allowed.length, 0);

  const wrongField = findViolations(`const project = { repoUrl: '${protectedUrl}' };`);
  assert.ok(wrongField.length >= 1);

  const rendered = findViolations(`const view = <button title="${protectedUrl}">Halo</button>;`, 'fixture.tsx');
  assert.ok(rendered.length >= 1);
});

test('application surfaces contain no restricted vocabulary', async () => {
  assert.deepEqual(await lintApplication(), []);
});

test('Halo keeps its exact neutral navigation contract', async () => {
  const seedSource = await readFile(new URL('../src/data/seedProjects.ts', import.meta.url), 'utf8');
  assert.ok(seedSource.includes(`url: '${protectedUrl}'`));
  assert.match(seedSource, /label: 'Halo Portfolio Agent'/);
  assert.match(seedSource, /callsign: 'HALO-PORTFOLIO'/);
});
