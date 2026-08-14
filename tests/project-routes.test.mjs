import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/projectRoutes.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const routes = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

test('legacy project routes resolve to not found', () => {
  const projectIds = ['talentquest', 'portfolio-command-center', 'standardcraft-build-swarm', 'legal-ops-console'];
  const retiredId = ['richard', 'job', 'search'].join('-');
  assert.deepEqual(routes.resolveProjectRoute(`#/projects/${retiredId}`, projectIds), {
    kind: 'not_found', requestedId: retiredId
  });
});

test('known project route and generated hash round trip', () => {
  const hash = routes.projectHash('portfolio-command-center');
  assert.deepEqual(routes.resolveProjectRoute(hash, ['portfolio-command-center']), {
    kind: 'project', projectId: 'portfolio-command-center'
  });
});
