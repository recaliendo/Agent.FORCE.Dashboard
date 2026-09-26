import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/readinessEngine.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const engine = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

function project(overrides = {}) {
  return {
    id: 'fixture', name: 'Fixture', callsign: 'FIXTURE', category: 'Test', status: 'Unknown', priority: 'Unknown',
    objective: 'Test project', missionBrief: 'Test project state', accent: 'cyan', tags: [], connectors: [], agents: [],
    launchActions: [], nextActions: [], ...overrides
  };
}

test('collectors change only when their live input changes', () => {
  const empty = engine.evaluateReadiness({ project: project(), nowMs: 1_000_000, savedReports: [], activity: [] });
  const connected = engine.evaluateReadiness({
    project: project({ connectors: [{ id: 'repo', type: 'github', label: 'Repo', status: 'connected' }] }),
    nowMs: 1_000_000,
    savedReports: [],
    activity: []
  });
  assert.equal(empty.signals.find((item) => item.key === 'connectors').status, 'unknown');
  assert.equal(connected.signals.find((item) => item.key === 'connectors').status, 'ready');
  assert.ok(connected.score > empty.score);
});

test('unknown project data produces explicit empty-state evidence', () => {
  const result = engine.evaluateReadiness({ project: project(), nowMs: 1_000_000, savedReports: [], activity: [] });
  assert.equal(result.actions[0].label, 'Configure project connectors');
  assert.ok(result.signals.some((item) => item.evidence === 'No agents configured.'));
  assert.ok(result.signals.some((item) => item.evidence === 'No saved reports.'));
});

test('readiness evaluation remains below the 50ms cockpit budget', () => {
  const input = { project: project(), nowMs: 1_000_000, savedReports: [], activity: [] };
  const started = performance.now();
  for (let index = 0; index < 1_000; index += 1) engine.evaluateReadiness(input);
  const perEvaluation = (performance.now() - started) / 1_000;
  assert.ok(perEvaluation < 50, `expected <50ms, measured ${perEvaluation.toFixed(3)}ms`);
});
