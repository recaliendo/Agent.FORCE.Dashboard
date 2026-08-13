import type { CouncilRun } from '../council/councilTypes';
import type { AgentProject, DailyReport } from '../types';
import { characterRegistry, getCharacterById } from './characterRegistry';
import type { AgentCharacter, CharacterState } from './characterTypes';

export interface CharacterSignal {
  character: AgentCharacter;
  state: CharacterState;
  reason: string;
  nextAction: string;
}

function withState(characterId: string, state: CharacterState, reason: string, nextAction: string): CharacterSignal {
  const character = getCharacterById(characterId) ?? characterRegistry[0];
  return { character, state, reason, nextAction };
}

export function getProjectAdvisorSignal(project: AgentProject, councilRun?: CouncilRun | null, report?: DailyReport | null): CharacterSignal {
  const highCouncilFindings = councilRun?.findings.filter((finding) =>
    (finding.severity === 'Critical' || finding.severity === 'High')
    && finding.status !== 'fixed'
    && finding.status !== 'retest_passed'
  ).length ?? 0;
  const softwareRepairs = councilRun?.engineeringRepairs.length ?? 0;
  const connectorIssues = project.connectors.filter((connector) =>
    connector.status === 'attention' || connector.status === 'needs_setup' || connector.status === 'unknown'
  ).length;
  const missingLaunchActions = project.launchActions.length === 0 || project.agents.some((agent) => agent.launchActions.length === 0);

  if (project.telemetry.risk >= 55 || highCouncilFindings > 0) {
    return withState(
      'princess-leia',
      'warning',
      highCouncilFindings
        ? `${highCouncilFindings} Critical/High Council finding${highCouncilFindings === 1 ? '' : 's'} need QA attention.`
        : `Risk telemetry is elevated at ${project.telemetry.risk}%.`,
      'View QA Findings'
    );
  }

  if (softwareRepairs > 0 || missingLaunchActions) {
    return withState(
      'luke-skywalker',
      softwareRepairs > 0 ? 'repairing' : 'reviewing',
      softwareRepairs > 0 ? 'Engineering repair plan is ready for Codex execution.' : 'Launch paths need configuration before this project feels operational.',
      softwareRepairs > 0 ? 'Generate Repair Prompt' : 'Review Launch Actions'
    );
  }

  if (/portfolio|brand|marketing|seo/i.test(`${project.category} ${project.tags.join(' ')}`)) {
    return withState(
      'chewmacka',
      'reviewing',
      'Brand, readability, SEO, and navigation clarity are primary signals for this project.',
      'Review Brand/SEO Findings'
    );
  }

  if (!project.customerNeed || !project.successCriteria?.length) {
    return withState(
      'han-solo',
      'warning',
      'Customer need or success criteria need stronger product definition.',
      'View Product Direction'
    );
  }

  if (councilRun?.executiveDecision?.decision === 'Approved') {
    return withState(
      'ceo',
      'approved',
      `CEO decision is approved at ${councilRun.executiveDecision.releaseReadinessScore}% readiness.`,
      'View Final Decision'
    );
  }

  if (connectorIssues > 0) {
    return withState(
      'master-verdant',
      'warning',
      `${connectorIssues} connector signal${connectorIssues === 1 ? '' : 's'} need review before launch confidence is high.`,
      'Ask Mentor for Next Step'
    );
  }

  return withState(
    'master-verdant',
    report ? 'completed' : 'idle',
    report ? 'A daily operating brief is available. Use it to choose the next action.' : 'Guidance is available for the next mission move.',
    'Ask Mentor for Next Step'
  );
}

export function getCouncilCharacterState(characterId: string, councilRun?: CouncilRun | null): CharacterState {
  if (!councilRun) return 'idle';
  const decision = councilRun.executiveDecision?.decision;
  const hasCritical = councilRun.findings.some((finding) => finding.severity === 'Critical');
  const hasHigh = councilRun.findings.some((finding) => finding.severity === 'High');

  if (decision === 'Blocked') return characterId === 'ceo' ? 'blocked' : 'warning';
  if (decision === 'Approved') return 'approved';
  if (characterId === 'princess-leia') return hasCritical || hasHigh ? 'warning' : 'scanning';
  if (characterId === 'luke-skywalker') return councilRun.engineeringRepairs.length ? 'repairing' : 'idle';
  if (characterId === 'chewmacka') return councilRun.marketingDirection.length ? 'reviewing' : 'idle';
  if (characterId === 'han-solo') return councilRun.productDirection.length ? 'reviewing' : 'idle';
  if (characterId === 'ceo') return decision === 'Approved with Conditions' ? 'warning' : 'reviewing';
  return 'idle';
}

export function getCouncilCharacterSummary(characterId: string, councilRun?: CouncilRun | null) {
  const findings = councilRun?.findings.filter((finding) => finding.agentId === characterId) ?? [];
  const assignedRepairs = councilRun?.findings.filter((finding) => {
    if (characterId === 'luke-skywalker') return finding.assignedTo === 'software_engineer';
    if (characterId === 'han-solo') return finding.assignedTo === 'chief_product_officer';
    return false;
  }) ?? [];

  if (!councilRun) {
    return {
      findingCount: 0,
      assignedRepairCount: 0,
      output: 'Awaiting first Council run.'
    };
  }

  if (characterId === 'luke-skywalker') {
    return {
      findingCount: findings.length,
      assignedRepairCount: assignedRepairs.length,
      output: councilRun.engineeringRepairs[0] ?? 'No engineering repair queued.'
    };
  }

  if (characterId === 'chewmacka') {
    return {
      findingCount: findings.length,
      assignedRepairCount: assignedRepairs.length,
      output: councilRun.marketingDirection[0] ?? 'No marketing direction queued.'
    };
  }

  if (characterId === 'han-solo') {
    return {
      findingCount: findings.length,
      assignedRepairCount: assignedRepairs.length,
      output: councilRun.productDirection[0] ?? 'No product direction queued.'
    };
  }

  if (characterId === 'ceo') {
    return {
      findingCount: findings.length,
      assignedRepairCount: assignedRepairs.length,
      output: councilRun.executiveDecision?.summary ?? 'Executive decision pending.'
    };
  }

  return {
    findingCount: findings.length,
    assignedRepairCount: assignedRepairs.length,
    output: findings[0]?.recommendedRepair ?? 'No QA finding queued.'
  };
}

export function getFindingCharacterId(agentId: string) {
  if (agentId === 'princess-leia') return 'princess-leia';
  if (agentId === 'chewmacka') return 'chewmacka';
  if (agentId === 'han-solo') return 'han-solo';
  if (agentId === 'ceo') return 'ceo';
  return 'luke-skywalker';
}
