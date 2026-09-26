import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/data/seedProjects.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { seedProjects } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

test('fleet infrastructure is source-representative and evidence-qualified', () => {
  const talentQuest = seedProjects.find((project) => project.id === 'talentquest');
  const standardCraft = seedProjects.find((project) => project.id === 'standardcraft-build-swarm');
  const divorceAgent = seedProjects.find((project) => project.id === 'legal-ops-console');

  assert.deepEqual(talentQuest.connectors.map((connector) => connector.id), [
    'talentquest-github',
    'talentquest-supabase',
    'talentquest-lovable'
  ]);

  assert.deepEqual(standardCraft.connectors.map((connector) => connector.id), [
    'standardcraft-github',
    'standardcraft-netlify',
    'standardcraft-supabase',
    'standardcraft-stripe',
    'standardcraft-smtp',
    'standardcraft-ci',
    'standardcraft-ops-mcp',
    'standardcraft-analytics'
  ]);
  assert.deepEqual(
    standardCraft.connectors.filter((connector) => connector.status === 'connected').map((connector) => connector.id),
    ['standardcraft-github', 'standardcraft-netlify']
  );
  assert.ok(standardCraft.connectors.every((connector) => connector.description));
  assert.ok(standardCraft.connectors.filter((connector) => connector.status !== 'connected').every((connector) => connector.reason && connector.nextStep));
  assert.ok(seedProjects.flatMap((project) => project.connectors).every((connector) => connector.description));
  assert.ok(divorceAgent.unknownFields.includes('repository'));
});
