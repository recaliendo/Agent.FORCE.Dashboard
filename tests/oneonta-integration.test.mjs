import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load(relative) {
  const source = await readFile(new URL(relative, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const { seedProjects } = await load('../src/data/seedProjects.ts');
const { rankingsData } = await load('../src/data/oneontaRankings.ts');

test('Oneonta Fantasy is registered with its repo, live site, and Rankings workspace', () => {
  const project = seedProjects.find((p) => p.id === 'oneonta-fantasy-rankings');
  assert.ok(project, 'project is in the roster');
  assert.equal(project.recordsWorkspace, 'oneonta-rankings');
  assert.equal(project.repository.url, 'https://github.com/recaliendo/oneonta-analytics-hub');
  assert.deepEqual(project.connectors.map((c) => c.id), ['oneonta-github', 'oneonta-live-site', 'oneonta-lovable']);
  // Unverified connectors must say why and what to do next.
  assert.ok(project.connectors.filter((c) => c.status !== 'connected').every((c) => c.reason && c.nextStep));
  const ids = project.launchActions.map((a) => a.id);
  assert.ok(ids.includes('oneonta-live-site') && ids.includes('oneonta-repo'), 'panel buttons resolve to launch actions');
  assert.equal(project.launchActions.find((a) => a.id === 'oneonta-live-site').target, 'https://oneontafantasy.live/');
  assert.ok(project.launchActions.every((a) => a.type === 'url' && a.target.startsWith('https://')));
});

test('Rankings snapshot is complete and ordered', () => {
  const r = rankingsData.rankings;
  assert.deepEqual(
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.length])),
    { flex: 30, qb: 20, rb: 25, wr: 30, te: 20, k: 20, dst: 32 }
  );
  for (const rows of Object.values(r)) {
    rows.forEach((row, index) => {
      assert.equal(row.rank, index + 1);
      assert.ok(row.player && row.team && row.opponent && row.tier && row.note);
    });
  }
  assert.equal(r.qb[0].player, 'Josh Allen');
  assert.equal(r.flex[0].player, 'Jahmyr Gibbs');
  assert.equal(rankingsData.refreshSchedule, 'Tuesday 8:00 AM ET');
});

test('Rankings search filters by player or team', async () => {
  const source = await readFile(new URL('../src/components/OneontaRankingsPanel.tsx', import.meta.url), 'utf8');
  const fn = /export function filterRankings[\s\S]*?\n}\n/.exec(source)[0];
  const js = ts.transpileModule(fn, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { filterRankings } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  const qb = rankingsData.rankings.qb;
  assert.equal(filterRankings(qb, '').length, qb.length);
  assert.deepEqual(filterRankings(qb, 'mahomes').map((row) => row.player), ['Patrick Mahomes']);
  assert.deepEqual(filterRankings(qb, ' buf ').map((row) => row.player), ['Josh Allen']);
});
