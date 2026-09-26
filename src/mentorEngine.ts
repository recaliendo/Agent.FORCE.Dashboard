import type { AgentProject, DailyReport } from './types';
import type { CouncilRun } from './council/councilTypes';
import { evaluateReadiness } from './readinessEngine';

const USER_NICKNAME = 'Ricky';

export function getMentorGreeting() {
  return `Welcome back, ${USER_NICKNAME}. Choose your mission, and the Agent FORCE will align around it.`;
}

export function getLaunchBayGuidance(projectCount: number, agentCount: number) {
  return `${USER_NICKNAME}, ${projectCount} project cockpits and ${agentCount} agent definitions are standing by. Choose the mission with the highest priority or weakest readiness signal first.`;
}

export function getProjectGuidance(project: AgentProject) {
  const snapshot = evaluateReadiness({ project, savedReports: [], activity: [], nowMs: Date.now() });
  const { score: readiness, automation, risk, coverage } = snapshot;
  const missingConnectors = project.connectors.filter((connector) => connector.status === 'needs_setup' || connector.status === 'unknown').length;
  const attentionConnectors = project.connectors.filter((connector) => connector.status === 'attention').length;

  if (risk >= 55) {
    return `${USER_NICKNAME}, risk is rising in ${project.callsign}. Stabilize blockers, clarify ownership, and convert the top risk into a named next action before expanding scope.`;
  }

  if (attentionConnectors > 0) {
    return `${USER_NICKNAME}, ${project.callsign} has ${attentionConnectors} connector signal${attentionConnectors === 1 ? '' : 's'} needing attention. Clear connector posture before calling the mission ready.`;
  }

  if (missingConnectors > 0) {
    return `${USER_NICKNAME}, connector coverage is incomplete. Link the repo, deployment, data, payment, or custom systems that this project depends on before launch.`;
  }

  if (project.launchActions.length === 0) {
    return `${USER_NICKNAME}, this cockpit has no launch actions. Add safe URLs or local paths so the mission can move from planning into action.`;
  }

  if (readiness < 60) {
    return `${USER_NICKNAME}, ${project.callsign} needs setup discipline. Focus on QA, project paths, launch actions, and the minimum checks needed to reach launch posture.`;
  }

  if (automation < 55) {
    return `${USER_NICKNAME}, this cockpit has useful intent but low automation. Add repeatable workflows, safe launch actions, and report history so the mission can run with less manual effort.`;
  }

  if (coverage < 60) {
    return `${USER_NICKNAME}, coverage is thin. Add one focused operator or launch action before starting the next workflow so no critical lane is unattended.`;
  }

  return `${USER_NICKNAME}, ${project.callsign} is close to strong launch posture. Focus now on the weakest telemetry signal and keep the next action list sharp.`;
}

export function getCouncilGuidance(project: AgentProject, councilRun?: CouncilRun | null) {
  if (!councilRun) {
    return `Run the Agent FORCE Council when ${project.callsign} needs QA, repair planning, product direction, or release approval.`;
  }

  const critical = councilRun.findings.filter((finding) => finding.severity === 'Critical').length;
  const high = councilRun.findings.filter((finding) => finding.severity === 'High').length;
  const decision = councilRun.executiveDecision?.decision ?? 'Pending';

  if (critical > 0 || high > 0) {
    return `${USER_NICKNAME}, the QA review has flagged ${critical + high} high-priority Council finding${critical + high === 1 ? '' : 's'}. Send them to engineering before calling ${project.callsign} launch-ready.`;
  }

  return `${USER_NICKNAME}, the latest Council decision is ${decision}. Use the executive directives and product guidance to choose the next action.`;
}

export function getAgentDeckGuidance(project: AgentProject) {
  if (project.agents.length === 0) {
    return `${USER_NICKNAME}, the agent deck is empty. Define one focused operator with a clear role before launching workflows.`;
  }

  const planningAgents = project.agents.filter((agent) => agent.status === 'Planning').length;
  if (planningAgents > 0) {
    return `${USER_NICKNAME}, ${planningAgents} agent unit${planningAgents === 1 ? '' : 's'} still need configuration. Start with the one closest to the current objective.`;
  }

  return `${USER_NICKNAME}, the agent deck has defined operators. Review launch actions next so each unit can move from definition to execution.`;
}

export function getReportGuidance(project: AgentProject, report?: DailyReport | null) {
  if (!report) {
    return `${USER_NICKNAME}, generate the daily mission report to convert telemetry into an executive operating brief.`;
  }

  if (report.setupNeededConnectorCount + report.attentionConnectorCount > 0) {
    return `${USER_NICKNAME}, today's report shows connector work remains. Stabilize the connector hub before expanding the mission plan.`;
  }

  const weakest = [
    ['readiness', report.readinessScore],
    ['automation', report.automationScore],
    ['coverage', report.coverageScore],
    ['risk control', 100 - report.riskScore]
  ].sort((a, b) => Number(a[1]) - Number(b[1]))[0][0];

  return `${USER_NICKNAME}, today's report is your command brief for ${project.callsign}. The next best move is to improve ${weakest} and turn one recommendation into a scheduled action.`;
}

export function getConnectorGuidance(project: AgentProject) {
  if (project.connectors.length === 0) {
    return `${USER_NICKNAME}, no connectors are mapped yet. Add non-secret references for the repo, deployment, data, billing, or operating systems this project relies on.`;
  }

  const needsSetup = project.connectors.filter((connector) => connector.status === 'needs_setup' || connector.status === 'unknown').length;
  const attention = project.connectors.filter((connector) => connector.status === 'attention').length;

  if (attention > 0) {
    return `${USER_NICKNAME}, ${attention} connector${attention === 1 ? '' : 's'} need attention. Resolve those signals before trusting the cockpit as launch-ready.`;
  }

  if (needsSetup > 0) {
    return `${USER_NICKNAME}, ${needsSetup} connector${needsSetup === 1 ? '' : 's'} still need setup. Complete connector references without storing secrets.`;
  }

  return `${USER_NICKNAME}, connector posture is strong. Keep references current and continue avoiding secrets in project metadata.`;
}
