import type { AgentProject } from '../types';
import type { CouncilRun } from './councilTypes';

export function buildCodexRepairPrompt(project: AgentProject, run: CouncilRun) {
  const findings = run.findings.map((finding) => [
    `### ${finding.severity}: ${finding.title}`,
    `- Agent: ${finding.agentId}`,
    `- Impacted area: ${finding.impactedArea}`,
    `- Finding: ${finding.finding}`,
    `- Recommended repair: ${finding.recommendedRepair}`,
    `- Acceptance criteria: ${finding.acceptanceCriteria}`,
    `- Assigned owner: ${finding.assignedTo ?? 'unassigned'}`
  ].join('\n')).join('\n\n');

  return [
    `You are working in Agent FORCE Dashboard on project: ${project.name}.`,
    '',
    'Act as Codex implementation owner for the Agent FORCE Council repair plan.',
    '',
    'Rules:',
    '- Preserve the multi-project architecture.',
    '- Keep Electron command execution disabled by default and gated by AGENT_FORCE_ALLOW_COMMANDS=true.',
    '- Do not store secrets, tokens, passwords, API keys, or private credentials.',
    '- Do not use official franchise images, logos, quotes, or protected likenesses.',
    '- Implement actual code changes only where needed; otherwise document deferred work.',
    '',
    `Council run: ${run.id}`,
    `Scope: ${run.targetScope}`,
    `CEO decision: ${run.executiveDecision?.decision ?? 'Pending'}`,
    `Release readiness score: ${run.executiveDecision?.releaseReadinessScore ?? 0}`,
    '',
    '## QA Findings',
    findings || 'No QA findings.',
    '',
    '## Marketing/SEO/Brand Direction',
    ...run.marketingDirection.map((item) => `- ${item}`),
    '',
    '## Product Direction',
    ...run.productDirection.map((item) => `- ${item}`),
    '',
    '## Engineering Repair Plan',
    ...run.engineeringRepairs.map((item) => `- ${item}`),
    '',
    '## CEO Final Directives',
    ...(run.executiveDecision?.requiredNextActions ?? []).map((item) => `- ${item}`),
    '',
    '## Acceptance Criteria',
    '- TypeScript passes.',
    '- Build passes.',
    '- Council findings are resolved or explicitly deferred.',
    '- QA retest confirms no Critical or High defects remain.',
    '',
    '## Test Commands',
    '```bash',
    'npm install',
    'npm run typecheck',
    'npm run build',
    'npm run electron:dev',
    '```',
    ''
  ].join('\n');
}
