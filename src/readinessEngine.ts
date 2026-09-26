import type { CouncilRun } from './council/councilTypes';
import type { AgentProject, DailyReport, ProjectActivity } from './types';

export type ReadinessEvidenceKey =
  | 'connectors'
  | 'agents'
  | 'council'
  | 'deployment'
  | 'reports'
  | 'activity';

export type SignalStatus = 'ready' | 'attention' | 'unknown';

export interface ReadinessSignal {
  key: ReadinessEvidenceKey;
  label: string;
  status: SignalStatus;
  score: number;
  weight: number;
  evidence: string;
  action: string;
}

export interface RankedAction {
  id: ReadinessEvidenceKey;
  label: string;
  reason: string;
  evidenceKeys: ReadinessEvidenceKey[];
  urgency: number;
}

export interface ReadinessSnapshot {
  score: number;
  risk: number;
  automation: number;
  coverage: number;
  signals: ReadinessSignal[];
  actions: RankedAction[];
  topRisk: string;
}

export interface ReadinessInput {
  project: AgentProject;
  councilRun?: CouncilRun | null;
  savedReports?: DailyReport[];
  activity?: ProjectActivity[];
  nowMs: number;
}

function signal(
  key: ReadinessEvidenceKey,
  label: string,
  status: SignalStatus,
  score: number,
  weight: number,
  evidence: string,
  action: string
): ReadinessSignal {
  return { key, label, status, score, weight, evidence, action };
}

export function collectConnectorSignal(project: AgentProject): ReadinessSignal {
  if (!project.connectors.length) {
    return signal('connectors', 'Connector posture', 'unknown', 0, 25, 'No connectors configured.', 'Configure project connectors');
  }
  const connected = project.connectors.filter((item) => item.status === 'connected').length;
  const issues = project.connectors.length - connected;
  return signal(
    'connectors',
    'Connector posture',
    issues ? 'attention' : 'ready',
    Math.round((connected / project.connectors.length) * 100),
    25,
    `${connected}/${project.connectors.length} connectors are connected.`,
    issues ? 'Review connector setup' : 'Review connected systems'
  );
}

export function collectAgentSignal(project: AgentProject): ReadinessSignal {
  if (!project.agents.length) {
    return signal('agents', 'Agent configuration', 'unknown', 0, 20, 'No agents configured.', 'Configure project agents');
  }
  const configured = project.agents.filter((agent) => agent.launchActions.length > 0 && !['Draft', 'Needs Configuration'].includes(agent.status)).length;
  return signal(
    'agents',
    'Agent configuration',
    configured === project.agents.length ? 'ready' : 'attention',
    Math.round((configured / project.agents.length) * 100),
    20,
    `${configured}/${project.agents.length} agents have a usable launch path.`,
    configured === project.agents.length ? 'Review agent coverage' : 'Complete agent configuration'
  );
}

export function collectCouncilSignal(councilRun?: CouncilRun | null): ReadinessSignal {
  if (!councilRun) {
    return signal('council', 'Council review', 'unknown', 0, 20, 'No Council run recorded.', 'Run Council review');
  }
  const blockers = councilRun.findings.filter((item) =>
    (item.severity === 'Critical' || item.severity === 'High')
    && item.status !== 'fixed'
    && item.status !== 'retest_passed'
  ).length;
  return signal(
    'council',
    'Council review',
    blockers ? 'attention' : 'ready',
    blockers ? Math.max(0, 70 - blockers * 20) : 100,
    20,
    blockers ? `${blockers} Critical/High findings remain open.` : 'No Critical/High findings remain open.',
    blockers ? 'Open Council findings' : 'Review Council decision'
  );
}

export function collectDeploymentSignal(project: AgentProject): ReadinessSignal {
  const candidates = [project.repository?.url, ...project.launchActions.map((action) => action.target)].filter(Boolean) as string[];
  if (!candidates.length) {
    return signal('deployment', 'Primary target', 'unknown', 0, 15, 'No primary repository or launch target configured.', 'Configure a primary target');
  }
  const valid = candidates.some((target) => {
    try {
      return ['https:', 'http:', 'mailto:'].includes(new URL(target).protocol);
    } catch {
      return false;
    }
  });
  return signal(
    'deployment',
    'Primary target',
    valid ? 'ready' : 'attention',
    valid ? 100 : 0,
    15,
    valid ? 'A valid primary target is configured.' : 'Configured targets are not valid safe URLs.',
    valid ? 'Review primary target' : 'Repair primary target'
  );
}

export function collectReportSignal(reports: DailyReport[] = [], nowMs: number): ReadinessSignal {
  if (!reports.length) {
    return signal('reports', 'Report freshness', 'unknown', 0, 10, 'No saved reports.', 'Generate a daily report');
  }
  const generatedMs = Date.parse(reports[0].generatedAt);
  const ageHours = Number.isFinite(generatedMs) ? Math.max(0, (nowMs - generatedMs) / 3_600_000) : Number.POSITIVE_INFINITY;
  const ready = ageHours <= 24;
  return signal(
    'reports',
    'Report freshness',
    ready ? 'ready' : 'attention',
    ready ? 100 : ageHours <= 168 ? 50 : 0,
    10,
    ready ? 'Latest report is less than 24 hours old.' : 'Latest report is stale.',
    ready ? 'Review latest report' : 'Generate a fresh report'
  );
}

export function collectActivitySignal(activity: ProjectActivity[] = [], nowMs: number): ReadinessSignal {
  if (!activity.length) {
    return signal('activity', 'Activity recency', 'unknown', 0, 10, 'No project activity recorded.', 'Open the project workspace');
  }
  const activityMs = Date.parse(activity[0].createdAt);
  const ageHours = Number.isFinite(activityMs) ? Math.max(0, (nowMs - activityMs) / 3_600_000) : Number.POSITIVE_INFINITY;
  const ready = ageHours <= 72;
  return signal(
    'activity',
    'Activity recency',
    ready ? 'ready' : 'attention',
    ready ? 100 : 25,
    10,
    ready ? 'Project activity was recorded within 72 hours.' : 'Project activity is stale.',
    ready ? 'Review recent activity' : 'Continue project activity'
  );
}

export function evaluateReadiness(input: ReadinessInput): ReadinessSnapshot {
  const signals = [
    collectConnectorSignal(input.project),
    collectAgentSignal(input.project),
    collectCouncilSignal(input.councilRun),
    collectDeploymentSignal(input.project),
    collectReportSignal(input.savedReports, input.nowMs),
    collectActivitySignal(input.activity, input.nowMs)
  ];
  const totalWeight = signals.reduce((total, item) => total + item.weight, 0);
  const score = Math.round(signals.reduce((total, item) => total + item.score * item.weight, 0) / totalWeight);
  const configuredActions = input.project.launchActions.length + input.project.agents.reduce((total, agent) => total + agent.launchActions.length, 0);
  const automation = Math.min(100, Math.round((configuredActions / Math.max(1, input.project.agents.length + 1)) * 100));
  const coverage = Math.round((signals.filter((item) => item.status !== 'unknown').length / signals.length) * 100);
  const risk = Math.max(0, 100 - score);
  const actions = signals
    .filter((item) => item.status !== 'ready')
    .map((item) => ({
      id: item.key,
      label: item.action,
      reason: item.evidence,
      evidenceKeys: [item.key],
      urgency: item.weight * (item.status === 'attention' ? 2 : 1)
    }))
    .sort((left, right) => right.urgency - left.urgency || left.id.localeCompare(right.id));
  const topSignal = signals
    .filter((item) => item.status !== 'ready')
    .sort((left, right) => right.weight * (right.status === 'attention' ? 2 : 1) - left.weight * (left.status === 'attention' ? 2 : 1))[0];

  return {
    score,
    risk,
    automation,
    coverage,
    signals,
    actions,
    topRisk: topSignal?.evidence ?? 'No readiness blocker detected.'
  };
}
