import { getReportGuidance } from './mentorEngine';
import type { CouncilRun } from './council/councilTypes';
import type { AgentProject, DailyReport, DailyReportItem, ProjectConnector } from './types';

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function makeItem(signal: DailyReportItem['signal'], title: string, detail: string): DailyReportItem {
  return {
    id: `${signal}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    signal,
    title,
    detail
  };
}

function statusPhrase(project: AgentProject) {
  if (project.telemetry.risk >= 55) return 'requires stabilization';
  if (project.telemetry.readiness >= 80 && project.telemetry.coverage >= 70) return 'is in strong launch posture';
  if (project.status === 'Ready') return 'is ready for focused execution';
  if (project.status === 'Needs QA') return 'needs quality validation before expansion';
  return 'is progressing through build posture';
}

function weakestSignal(project: AgentProject) {
  const signals = [
    { label: 'readiness', value: project.telemetry.readiness },
    { label: 'automation', value: project.telemetry.automation },
    { label: 'coverage', value: project.telemetry.coverage },
    { label: 'risk control', value: 100 - project.telemetry.risk }
  ];
  return signals.sort((a, b) => a.value - b.value)[0];
}

function connectorSummary(connectors: ProjectConnector[]) {
  const connected = connectors.filter((connector) => connector.status === 'connected').length;
  const setupNeeded = connectors.filter((connector) => connector.status === 'needs_setup' || connector.status === 'unknown').length;
  const attention = connectors.filter((connector) => connector.status === 'attention').length;
  const types = ['github', 'supabase', 'netlify', 'stripe'] as const;
  const coverage = types
    .map((type) => `${type}: ${connectors.some((connector) => connector.type === type) ? 'mapped' : 'missing'}`)
    .join(' | ');

  return {
    connected,
    setupNeeded,
    attention,
    posture: connectors.length
      ? `${connected}/${connectors.length} connected; ${setupNeeded} setup-needed or unknown; ${attention} attention. Coverage: ${coverage}.`
      : 'No connector references are configured yet.'
  };
}

export function generateDailyReport(project: AgentProject, latestCouncilRun?: CouncilRun | null): DailyReport {
  const generatedAt = new Date().toISOString();
  const weakest = weakestSignal(project);
  const readinessScore = clampScore(project.telemetry.readiness);
  const automationScore = clampScore(project.telemetry.automation);
  const riskScore = clampScore(project.telemetry.risk);
  const coverageScore = clampScore(project.telemetry.coverage);
  const connector = connectorSummary(project.connectors);

  const customerNeed = project.customerNeed ?? `The customer need for ${project.callsign} should be clarified in the project registry.`;
  const executiveSummary = `Today's mission posture for ${project.name} ${statusPhrase(project)}, with readiness at ${readinessScore}% and coverage at ${coverageScore}%. The strongest operating focus is ${project.objective.toLowerCase()}. Customer need: ${customerNeed} Risk is ${riskScore >= 55 ? 'elevated and should be reduced before expanding automation' : 'controlled enough for disciplined execution'}, the weakest telemetry signal is ${weakest.label} at ${weakest.value}%, and connector posture is ${connector.connected}/${project.connectors.length || 0} connected.`;

  const wins = [
    makeItem('win', 'Project cockpit is defined', `${project.callsign} has a clear mission brief, objective, priority, telemetry profile, and launch posture.`),
    makeItem('win', 'Agent deck has operating coverage', `${project.agents.length} agent unit${project.agents.length === 1 ? '' : 's'} are mapped to this project with roles and status signals.`),
    makeItem('metric', 'Launch actions are visible', `${project.launchActions.length} launch action${project.launchActions.length === 1 ? '' : 's'} are configured for quick project access.`),
    makeItem('metric', 'Connector posture is tracked', connector.posture)
  ];

  const risks = [
    riskScore >= 50
      ? makeItem('risk', 'Risk requires command attention', `Risk is currently ${riskScore}%. Stabilize blockers, ownership, and QA before adding more moving parts.`)
      : makeItem('risk', 'Risk remains controlled', `Risk is currently ${riskScore}%. Keep monitoring blockers and preserve command safety.`),
    automationScore < 60
      ? makeItem('risk', 'Automation needs reinforcement', `Automation is ${automationScore}%. Add repeatable launch actions, QA commands, or saved workflows.`)
      : makeItem('metric', 'Automation is usable', `Automation is ${automationScore}%. Continue turning repeatable work into safe launch actions.`),
    coverageScore < 60
      ? makeItem('blocked', 'Coverage gap detected', `Coverage is ${coverageScore}%. Add agents or actions for the missing operational lanes.`)
      : makeItem('metric', 'Coverage supports execution', `Coverage is ${coverageScore}%. Review whether each agent has a next action and launch path.`),
    connector.attention > 0
      ? makeItem('risk', 'Connector attention needed', `${connector.attention} connector${connector.attention === 1 ? '' : 's'} need attention before launch confidence is high.`)
      : connector.setupNeeded > 0
        ? makeItem('blocked', 'Connector setup incomplete', `${connector.setupNeeded} connector${connector.setupNeeded === 1 ? '' : 's'} still need setup or verification.`)
        : makeItem('metric', 'Connector posture is stable', 'No connector attention or setup blockers are currently flagged.')
  ];

  const nextBestActions = project.nextActions.slice(0, 4).map((action, index) =>
    makeItem('next', `Next action ${index + 1}`, action)
  );

  if (project.currentBlockers?.length) {
    nextBestActions.unshift(makeItem('blocked', 'Current blocker to clear', project.currentBlockers[0]));
  }

  const agentPostureSummary = project.agents.length
    ? `${project.agents.map((agent) => `${agent.callsign}: ${agent.status}`).join(' | ')}`
    : 'No agent units are configured yet.';

  const commanderNotes = [
    `Priority remains ${project.priority}.`,
    `Weakest telemetry signal: ${weakest.label}.`,
    `Command safety remains gated through configured Electron launch controls.`,
    latestCouncilRun
      ? `Latest Council decision: ${latestCouncilRun.executiveDecision?.decision ?? 'Pending'} at ${latestCouncilRun.executiveDecision?.releaseReadinessScore ?? 0}% release readiness.`
      : 'No Agent FORCE Council run has been saved for this project yet.'
  ];

  const draft: Omit<DailyReport, 'mentorTip' | 'markdown'> = {
    id: `${project.id}-${generatedAt}`,
    projectId: project.id,
    generatedAt,
    title: `Daily Mission Report - ${project.name}`,
    executiveSummary,
    readinessScore,
    automationScore,
    riskScore,
    coverageScore,
    agentCount: project.agents.length,
    connectorCount: project.connectors.length,
    connectedConnectorCount: connector.connected,
    setupNeededConnectorCount: connector.setupNeeded,
    attentionConnectorCount: connector.attention,
    agentPostureSummary,
    connectorPostureSummary: connector.posture,
    wins,
    risks,
    nextBestActions,
    reportItems: [...wins, ...risks, ...nextBestActions],
    commanderNotes
  };

  if (latestCouncilRun) {
    draft.councilDecisionSummary = `${latestCouncilRun.executiveDecision?.decision ?? 'Pending'} at ${latestCouncilRun.executiveDecision?.releaseReadinessScore ?? 0}% release readiness.`;
    draft.councilTopRisk = latestCouncilRun.findings[0]?.title ?? 'No Council risk detected.';
    draft.councilTopEngineeringRepair = latestCouncilRun.engineeringRepairs[0] ?? 'No engineering repair queued.';
    draft.councilTopProductRecommendation = latestCouncilRun.productDirection[0] ?? 'No product recommendation queued.';
    draft.councilTopMarketingRecommendation = latestCouncilRun.marketingDirection[0] ?? 'No marketing recommendation queued.';
  }

  const mentorTip = getReportGuidance(project, draft as DailyReport);
  const report: DailyReport = {
    ...draft,
    mentorTip,
    markdown: ''
  };

  report.markdown = toReportMarkdown(report, project);
  return report;
}

export function toReportMarkdown(report: DailyReport, project: AgentProject) {
  const generated = new Date(report.generatedAt).toLocaleString();
  const section = (title: string, items: DailyReportItem[]) => [
    `## ${title}`,
    '',
    ...items.map((item) => `- **${item.title}:** ${item.detail}`),
    ''
  ].join('\n');

  return [
    `# ${report.title}`,
    '',
    `Generated: ${generated}`,
    `Project: ${project.name}`,
    `Callsign: ${project.callsign}`,
    `Status: ${project.status}`,
    `Priority: ${project.priority}`,
    `Category: ${project.category}`,
    '',
    '## Executive Summary',
    '',
    report.executiveSummary,
    '',
    '## Mission Context',
    '',
    `Objective: ${project.objective}`,
    `Mission brief: ${project.missionBrief}`,
    `Customer need: ${project.customerNeed ?? 'Not configured'}`,
    '',
    '## Success Criteria',
    '',
    ...(project.successCriteria?.length ? project.successCriteria.map((item) => `- ${item}`) : ['- Not configured']),
    '',
    '## Current Blockers',
    '',
    ...(project.currentBlockers?.length ? project.currentBlockers.map((item) => `- ${item}`) : ['- No current blockers configured']),
    '',
    '## Scores',
    '',
    `- Readiness: ${report.readinessScore}%`,
    `- Automation: ${report.automationScore}%`,
    `- Risk: ${report.riskScore}%`,
    `- Coverage: ${report.coverageScore}%`,
    '',
    '## Agent Posture',
    '',
    report.agentPostureSummary,
    '',
    '## Connector Posture',
    '',
    report.connectorPostureSummary,
    '',
    `- Connector count: ${report.connectorCount}`,
    `- Connected: ${report.connectedConnectorCount}`,
    `- Setup needed or unknown: ${report.setupNeededConnectorCount}`,
    `- Attention: ${report.attentionConnectorCount}`,
    '',
    ...(report.councilDecisionSummary ? [
      '## Latest Council Signal',
      '',
      `- Decision: ${report.councilDecisionSummary}`,
      `- Top QA risk: ${report.councilTopRisk}`,
      `- Top engineering repair: ${report.councilTopEngineeringRepair}`,
      `- Top product recommendation: ${report.councilTopProductRecommendation}`,
      `- Top marketing recommendation: ${report.councilTopMarketingRecommendation}`,
      ''
    ] : []),
    section('Mission Progress', report.wins),
    section('Risks & Blockers', report.risks),
    section('Next Best Actions', report.nextBestActions),
    '## Mentor Tip',
    '',
    report.mentorTip,
    '',
    '## Commander Notes',
    '',
    ...report.commanderNotes.map((note) => `- ${note}`),
    ''
  ].join('\n');
}
