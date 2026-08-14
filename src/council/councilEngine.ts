import type { AgentProject, ProjectConnector } from '../types';
import { buildCodexRepairPrompt } from './codexPromptBuilder';
import type {
  CouncilFinding,
  CouncilFindingSeverity,
  CouncilRun,
  CouncilRunContext,
  CouncilTargetScope,
  ExecutiveCouncilLens
} from './councilTypes';

function nowIso() {
  return new Date().toISOString();
}

function idSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'finding';
}

function finding(
  project: AgentProject,
  agentId: string,
  severity: CouncilFindingSeverity,
  title: string,
  impactedArea: string,
  findingText: string,
  recommendedRepair: string,
  acceptanceCriteria: string,
  assignedTo: CouncilFinding['assignedTo'],
  reproductionSteps: string[] = [`Open ${project.name}.`, `Inspect ${impactedArea}.`],
  expectedResult = 'The experience gives Ricky a clear, safe, actionable operating path.',
  actualResult = findingText
): CouncilFinding {
  return {
    id: `${agentId}-${idSlug(title)}`,
    agentId,
    projectId: project.id,
    title,
    severity,
    impactedArea,
    finding: findingText,
    reproductionSteps,
    expectedResult,
    actualResult,
    recommendedRepair,
    acceptanceCriteria,
    assignedTo,
    status: 'open',
    createdAt: nowIso()
  };
}

function unsafeUrl(connector: ProjectConnector) {
  if (!connector.url) return false;
  try {
    const parsed = new URL(connector.url);
    return !['https:', 'http:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return true;
  }
}

function buildQaFindings(context: CouncilRunContext) {
  const { project, savedDailyReports } = context;
  const findings: CouncilFinding[] = [];

  if (project.telemetry.risk >= 55) {
    findings.push(finding(
      project,
      'princess-leia',
      'High',
      'Risk telemetry is above launch threshold',
      'Project Telemetry',
      `Risk is ${project.telemetry.risk}%, which can hide blockers before release.`,
      'Add explicit risk reason, owner, mitigation action, and retest checkpoint for this project.',
      'Project cockpit shows the top risk reason, owner, next mitigation step, and status.',
      'software_engineer'
    ));
  }

  if (project.telemetry.readiness < 60) {
    findings.push(finding(
      project,
      'princess-leia',
      'High',
      'Readiness is below reliable operating posture',
      'Project Telemetry',
      `Readiness is ${project.telemetry.readiness}%, so the cockpit may not be ready for repeat use.`,
      'Add setup checklist, QA gate, and launch criteria to raise readiness.',
      'Readiness panel includes setup gaps and next QA gate.',
      'software_engineer'
    ));
  }

  if (project.launchActions.length === 0) {
    findings.push(finding(
      project,
      'princess-leia',
      'Medium',
      'No project launch actions configured',
      'Launch Actions',
      'The project cannot quickly open its primary workspace or dashboard from the cockpit.',
      'Add at least one safe URL or local path launch action.',
      'Launch Actions includes at least one safe, descriptive action or a clear setup state.',
      'software_engineer'
    ));
  }

  if (project.agents.length === 0) {
    findings.push(finding(
      project,
      'princess-leia',
      'High',
      'Agent deck is empty',
      'Agent Deck',
      'The project has no agent operators, reducing the value of the hub.',
      'Create at least one focused agent definition with role, status, and launch actions.',
      'Agent Deck shows a project-specific operator or a guided setup flow.',
      'software_engineer'
    ));
  }

  project.connectors.forEach((connector) => {
    if (connector.status === 'attention') {
      findings.push(finding(
        project,
        'princess-leia',
        'High',
        `${connector.label} connector needs attention`,
        'Connector Hub',
        'The connector is marked attention but may not include enough action context.',
        'Add reason, last checked timestamp, and next repair step for attention connectors.',
        'Connector card shows status reason, last checked time, and next step.',
        'software_engineer'
      ));
    }

    if ((connector.status === 'needs_setup' || connector.status === 'unknown') && !connector.url) {
      findings.push(finding(
        project,
        'princess-leia',
        'Medium',
        `${connector.label} is missing a non-secret URL`,
        'Connector Hub',
        'Connector setup is incomplete, making the cockpit less actionable.',
        'Add a non-secret dashboard, repository, or documentation link, or keep a clear setup-needed state.',
        'Connector either opens safely or clearly explains what setup is missing.',
        'software_engineer'
      ));
    }

    if (unsafeUrl(connector)) {
      findings.push(finding(
        project,
        'princess-leia',
        'Critical',
        `${connector.label} uses an unsafe URL`,
        'Electron Safety',
        'Connector URLs must use only http, https, or mailto.',
        'Replace unsafe connector URL with a safe URL or remove the open action.',
        'Unsafe connector URL is blocked and no direct shell/file protocol is exposed.',
        'software_engineer'
      ));
    }
  });

  if (!context.latestDailyReport && savedDailyReports.length === 0) {
    findings.push(finding(
      project,
      'princess-leia',
      'Low',
      'No saved daily report history',
      'Daily Report Center',
      'The project has not yet built trend history for daily operating briefs.',
      'Generate and save a daily report after major project work.',
      'Recent Reports shows a saved project-scoped report.',
      'software_engineer'
    ));
  }

  if (/portfolio|brand/i.test(project.category)) {
    findings.push(finding(
      project,
      'princess-leia',
      'Medium',
      'Portfolio cockpit should track source and website alignment',
      'Portfolio QA',
      'Portfolio readiness depends on consistency between website content, source facts, and the visitor scan path.',
      'Add or maintain a portfolio QA checklist covering source alignment, readability, SEO, and conversion clarity.',
      'Portfolio cockpit exposes source alignment, readability, and conversion QA signals.',
      'software_engineer'
    ));
  }

  if (/saas|product|build/i.test(project.category)) {
    const billingDataIssue = project.connectors.some((connector) => ['stripe', 'supabase', 'netlify'].includes(connector.type) && connector.status !== 'connected');
    if (billingDataIssue) {
      findings.push(finding(
        project,
        'princess-leia',
        'High',
        'SaaS launch connectors need release confidence',
        'SaaS Launch Readiness',
        'Stripe, Supabase, or Netlify posture is not fully connected, which can hide release blockers.',
        'Add safe connector references, last-check reason, and launch-readiness next steps for SaaS infrastructure.',
        'SaaS cockpit shows actionable status for billing, data/auth, and deployment references without storing secrets.',
        'software_engineer'
      ));
    }
  }

  if (/legal|document|case/i.test(project.category)) {
    findings.push(finding(
      project,
      'princess-leia',
      'High',
      'Legal operations require confidentiality guardrails',
      'Legal Ops Safety',
      'Document and evidence workflows need clear sensitive-data cautions and safe local reference handling.',
      'Keep legal documents out of localStorage and show safety notes near document/path launch actions.',
      'Cockpit displays confidentiality safety notes and references only approved local paths or documents.',
      'software_engineer'
    ));
  }

  return findings;
}

function buildMarketingFindings(project: AgentProject) {
  const findings: CouncilFinding[] = [];

  if (project.objective.length > 180) {
    findings.push(finding(
      project,
      'chewmacka',
      'Medium',
      'Project objective is hard to scan',
      'Project Card Copy',
      'Long objective copy can slow project selection.',
      'Shorten the card objective and move detail into the cockpit mission brief.',
      'Project card objective is concise and cockpit retains deeper context.',
      'software_engineer'
    ));
  }

  if (!project.tags.some((tag) => /qa|seo|brand|launch|customer|portfolio|product/i.test(tag))) {
    findings.push(finding(
      project,
      'chewmacka',
      'Low',
      'Tags do not clarify user value',
      'Brand and Navigation',
      'Tags may not help Ricky quickly identify the project purpose.',
      'Add tags that describe audience, outcome, or operating lane.',
      'Project card tags make the project easier to choose.',
      'software_engineer'
    ));
  }

  if (/portfolio|brand/i.test(project.category)) {
    findings.push(finding(
      project,
      'chewmacka',
      'Medium',
      'Portfolio value proposition should be immediately scannable',
      'Brand and Conversion',
      'Portfolio projects need recruiter-facing clarity, credibility, and scan speed.',
      'Keep the first-screen message focused on role positioning, proof points, and clear next click.',
      'Portfolio cockpit and report call out recruiter scanability and credibility checks.',
      'software_engineer'
    ));
  }

  if (/saas|product|build/i.test(project.category)) {
    findings.push(finding(
      project,
      'chewmacka',
      'Medium',
      'SaaS project needs buyer and conversion clarity',
      'Marketing and CTA Flow',
      'SaaS build operations should make buyer value, pricing, and launch CTA readiness easy to inspect.',
      'Add marketing/report guidance that names buyer value, pricing/CTA risk, and launch-copy next steps.',
      'Council report includes SaaS buyer-value and conversion recommendations.',
      'software_engineer'
    ));
  }

  return findings;
}

function buildProductFindings(project: AgentProject) {
  const findings: CouncilFinding[] = [];

  if (project.nextActions.length === 0) {
    findings.push(finding(
      project,
      'han-solo',
      'High',
      'Project has no prioritized next actions',
      'Product Direction',
      'The cockpit does not tell Ricky what to do next.',
      'Add 3-5 ranked next actions tied to customer outcome and mission speed.',
      'Next Actions contains prioritized steps that help Ricky complete the mission faster.',
      'chief_product_officer'
    ));
  }

  if (!/customer|user|ricky|client|recruiter|student|buyer|case|mission/i.test(`${project.objective} ${project.missionBrief}`)) {
    findings.push(finding(
      project,
      'han-solo',
      'Medium',
      'Customer outcome is not explicit',
      'Project Mission',
      'The objective is internally clear but does not state the user outcome strongly enough.',
      'Add a customer outcome or success measure to the mission brief.',
      'Cockpit states who benefits and what faster/better decision the project enables.',
      'chief_product_officer'
    ));
  }

  if (!project.customerNeed || !project.successCriteria?.length) {
    findings.push(finding(
      project,
      'han-solo',
      'Medium',
      'Customer need or success criteria are missing',
      'Product Direction',
      'The cockpit needs customer context to guide prioritization across project types.',
      'Add customer need and success criteria to the project registry.',
      'Overview tab shows customer need, success criteria, and blockers.',
      'chief_product_officer'
    ));
  }

  return findings;
}

function buildDirections(project: AgentProject, findings: CouncilFinding[]) {
  const highCount = findings.filter((findingItem) => findingItem.severity === 'High' || findingItem.severity === 'Critical').length;
  const connectorIssues = findings.filter((findingItem) => findingItem.impactedArea === 'Connector Hub').length;

  return {
    marketingDirection: [
      `Clarify ${project.callsign} labels so the project purpose is understood in one scan.`,
      'Keep copy credible, direct, and executive-readable; avoid hype.',
      connectorIssues ? 'Make connector setup copy specific and action-oriented.' : 'Preserve current connector copy clarity.',
      categoryDirection(project, 'marketing')
    ],
    productDirection: [
      'Does this help the customer make a better decision or complete the mission faster?',
      highCount ? 'Prioritize risk and readiness before expanding new features.' : 'Continue improving speed-to-value and repeatable operating flow.',
      `Next product focus: ${project.nextActions[0] ?? 'define a prioritized next action.'}`,
      categoryDirection(project, 'product')
    ],
    engineeringRepairs: [
      ...findings
        .filter((findingItem) => findingItem.assignedTo === 'software_engineer')
        .slice(0, 5)
        .map((findingItem) => `Repair ${findingItem.impactedArea}: ${findingItem.recommendedRepair}`),
      'Run TypeScript, build, and Electron smoke test after repairs.',
      'Request Princess Leia retest for all Critical and High findings.'
    ],
    retestNotes: [
      'Retest generated findings after code changes are completed by Codex or manually by the operator.',
      'Do not mark findings fixed unless implementation actually changed or the issue is explicitly deferred.'
    ]
  };
}

function categoryDirection(project: AgentProject, lane: 'marketing' | 'product') {
  if (/portfolio|brand/i.test(project.category)) {
    return lane === 'marketing'
      ? 'Portfolio language should optimize visitor scan speed, credibility, and SEO clarity.'
      : 'Prioritize the visitor path from proof point to contact review.';
  }
  if (/saas|product|build/i.test(project.category)) {
    return lane === 'marketing'
      ? 'SaaS copy should clarify buyer value, pricing confidence, and CTA readiness.'
      : 'Prioritize billing/auth/deploy reliability and customer value before new feature expansion.';
  }
  if (/legal|document|case/i.test(project.category)) {
    return lane === 'marketing'
      ? 'Legal ops language should stay precise, restrained, and confidentiality-aware.'
      : 'Prioritize evidence organization, timeline clarity, and sensitive-data controls.';
  }
  return 'Keep recommendations specific to this project category and customer outcome.';
}

function buildLenses(project: AgentProject, findings: CouncilFinding[]): ExecutiveCouncilLens[] {
  const criticalHigh = findings.filter((item) => item.severity === 'Critical' || item.severity === 'High').length;
  return [
    {
      id: 'first-principles-builder',
      name: 'First-Principles Builder Lens',
      recommendation: criticalHigh ? 'Solve the root readiness and risk issues before polishing secondary UI.' : 'The project is solving an actual operating-control problem; keep reducing setup friction.'
    },
    {
      id: 'high-visibility-persuasion',
      name: 'High-Visibility Persuasion Lens',
      recommendation: 'Keep labels memorable but literal so Ricky understands the mission without decoding internal jargon.'
    },
    {
      id: 'arr-investor',
      name: 'ARR and Investor Lens',
      recommendation: 'The Council becomes more valuable when it produces repeatable repair prompts and visible release-readiness scoring.'
    },
    {
      id: 'customer-trust',
      name: 'Customer Trust Lens',
      recommendation: 'No secrets should enter connector metadata; trust improves when safety boundaries are visible.'
    },
    {
      id: 'operational-scale',
      name: 'Operational Scale Lens',
      recommendation: `${project.name} should remain one project in a scalable cockpit model, not a one-off dashboard.`
    },
    {
      id: 'security-risk',
      name: 'Security and Risk Lens',
      recommendation: 'Maintain the Electron command gate and safe URL launcher for every Council-driven action.'
    },
    {
      id: 'design-excellence',
      name: 'Design Excellence Lens',
      recommendation: 'Use the HUD aesthetic to improve hierarchy and confidence, not to obscure operating decisions.'
    },
    {
      id: 'speed-to-value',
      name: 'Speed-to-Value Lens',
      recommendation: 'Ricky should see the top blocker, top repair, and next action within one cockpit scan.'
    }
  ];
}

function severityWeight(severity: CouncilFindingSeverity) {
  return { Critical: 28, High: 16, Medium: 7, Low: 3 }[severity];
}

function buildExecutiveDecision(project: AgentProject, findings: CouncilFinding[]): NonNullable<CouncilRun['executiveDecision']> {
  const blockers = findings.filter((findingItem) => findingItem.severity === 'Critical' || findingItem.severity === 'High');
  const readinessPenalty = findings.reduce((total, findingItem) => total + severityWeight(findingItem.severity), 0);
  const releaseReadinessScore = Math.max(0, Math.min(100, project.telemetry.readiness - readinessPenalty + Math.round(project.telemetry.coverage / 8)));
  const decision: NonNullable<CouncilRun['executiveDecision']>['decision'] = findings.some((item) => item.severity === 'Critical')
    ? 'Blocked'
    : blockers.length > 0
      ? 'Needs Repair'
      : releaseReadinessScore >= 78
        ? 'Approved'
        : 'Approved with Conditions';

  return {
    decision,
    releaseReadinessScore,
    summary: `${project.name} is ${decision.toLowerCase()} with ${findings.length} Council finding${findings.length === 1 ? '' : 's'} and ${blockers.length} Critical/High blocker${blockers.length === 1 ? '' : 's'}.`,
    topBlockers: blockers.slice(0, 5).map((item) => item.title),
    topRepairs: findings.slice(0, 5).map((item) => item.recommendedRepair),
    topOpportunities: [
      'Convert Council findings into Codex repair prompts.',
      'Add project-specific QA checklist customization.',
      'Connect Council reports to GitHub issues or Codex task creation.',
      'Track release readiness trends over time.',
      'Attach screenshots and test artifacts to Council runs.'
    ],
    requiredNextActions: [
      'Princess Leia retests Critical and High findings after repairs.',
      'Luke Skywalker implements the top repair plan without weakening safety.',
      'ChewMacka clarifies copy where setup or action language is unclear.',
      'Han Solo confirms each repair improves customer speed-to-value.',
      'CEO reviews the next Council run for release approval.'
    ],
    lenses: buildLenses(project, findings)
  };
}

function buildCouncilReport(project: AgentProject, run: Omit<CouncilRun, 'councilReportMarkdown' | 'codexPrompt'>) {
  const severityCounts = ['Critical', 'High', 'Medium', 'Low']
    .map((severity) => `- ${severity}: ${run.findings.filter((findingItem) => findingItem.severity === severity).length}`)
    .join('\n');

  return [
    `# Agent FORCE Council Report - ${project.name}`,
    '',
    `Run: ${run.id}`,
    `Scope: ${run.targetScope}`,
    `Started: ${run.startedAt}`,
    `Completed: ${run.completedAt ?? 'Pending'}`,
    '',
    '## Severity Summary',
    severityCounts,
    '',
    '## Findings',
    ...run.findings.map((item) => `- **${item.severity} / ${item.impactedArea}:** ${item.title} - ${item.recommendedRepair}`),
    '',
    '## Marketing Direction',
    ...run.marketingDirection.map((item) => `- ${item}`),
    '',
    '## Product Direction',
    ...run.productDirection.map((item) => `- ${item}`),
    '',
    '## Engineering Repair Plan',
    ...run.engineeringRepairs.map((item) => `- ${item}`),
    '',
    '## CEO Decision',
    `Decision: ${run.executiveDecision?.decision ?? 'Pending'}`,
    `Release readiness score: ${run.executiveDecision?.releaseReadinessScore ?? 0}`,
    run.executiveDecision?.summary ?? '',
    '',
    '## Executive Council Lenses',
    ...(run.executiveDecision?.lenses ?? []).map((lens) => `- **${lens.name}:** ${lens.recommendation}`),
    ''
  ].join('\n');
}

export function generateCouncilRun(context: CouncilRunContext): CouncilRun {
  const startedAt = nowIso();
  const qa = buildQaFindings(context);
  const marketing = buildMarketingFindings(context.project);
  const product = buildProductFindings(context.project);
  const findings = [...qa, ...marketing, ...product];
  const directions = buildDirections(context.project, findings);
  const executiveDecision = buildExecutiveDecision(context.project, findings);
  const status = executiveDecision.decision === 'Blocked'
    ? 'blocked'
    : executiveDecision.decision === 'Needs Repair'
      ? 'needs_repair'
      : 'approved';

  const partialRun: Omit<CouncilRun, 'codexPrompt' | 'councilReportMarkdown'> = {
    id: `${context.project.id}-council-${startedAt}`,
    projectId: context.project.id,
    targetAgentId: context.targetAgentId,
    targetScope: context.targetScope,
    status,
    startedAt,
    completedAt: nowIso(),
    findings,
    ...directions,
    executiveDecision
  };

  const report = buildCouncilReport(context.project, partialRun);
  const runWithoutPrompt: CouncilRun = {
    ...partialRun,
    councilReportMarkdown: report,
    codexPrompt: ''
  };

  return {
    ...runWithoutPrompt,
    codexPrompt: buildCodexRepairPrompt(context.project, runWithoutPrompt)
  };
}

export function summarizeCouncilRun(run?: CouncilRun | null) {
  if (!run) {
    return {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      open: 0,
      decision: 'No Council run',
      readiness: 0
    };
  }

  return {
    critical: run.findings.filter((item) => item.severity === 'Critical').length,
    high: run.findings.filter((item) => item.severity === 'High').length,
    medium: run.findings.filter((item) => item.severity === 'Medium').length,
    low: run.findings.filter((item) => item.severity === 'Low').length,
    open: run.findings.filter((item) => item.status === 'open' || item.status === 'in_progress').length,
    decision: run.executiveDecision?.decision ?? 'Pending',
    readiness: run.executiveDecision?.releaseReadinessScore ?? 0
  };
}

export function scopeLabel(scope: CouncilTargetScope) {
  return scope.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
