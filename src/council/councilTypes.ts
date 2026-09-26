import type { AgentProject, DailyReport } from '../types';

export type CouncilAgentRole =
  | 'qa_optimizer'
  | 'software_engineer'
  | 'marketing_executive'
  | 'chief_product_officer'
  | 'chief_executive_officer';

export type CouncilFindingSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export type CouncilRunStatus = 'not_started' | 'running' | 'needs_repair' | 'retesting' | 'approved' | 'blocked';

export type CouncilTargetScope =
  | 'whole_project'
  | 'agent'
  | 'connector_hub'
  | 'daily_report_center'
  | 'launch_actions'
  | 'ux_ui'
  | 'marketing_brand';

export type CouncilFindingStatus = 'open' | 'in_progress' | 'fixed' | 'deferred' | 'retest_passed';

export interface CouncilAgent {
  id: string;
  name: string;
  role: CouncilAgentRole;
  title: string;
  mission: string;
  expertise: string[];
  reviewChecklist: string[];
  outputContract: string[];
  handoffTo?: CouncilAgentRole[];
}

export interface CouncilFinding {
  id: string;
  agentId: string;
  projectId: string;
  targetId?: string;
  title: string;
  severity: CouncilFindingSeverity;
  impactedArea: string;
  finding: string;
  reproductionSteps: string[];
  expectedResult: string;
  actualResult: string;
  recommendedRepair: string;
  acceptanceCriteria: string;
  assignedTo?: CouncilAgentRole;
  status: CouncilFindingStatus;
  createdAt: string;
}

export interface ExecutiveCouncilLens {
  id: string;
  name: string;
  recommendation: string;
}

export interface CouncilRun {
  id: string;
  projectId: string;
  targetAgentId?: string;
  targetScope: CouncilTargetScope;
  status: CouncilRunStatus;
  startedAt: string;
  completedAt?: string;
  findings: CouncilFinding[];
  productDirection: string[];
  marketingDirection: string[];
  engineeringRepairs: string[];
  retestNotes: string[];
  codexPrompt: string;
  councilReportMarkdown: string;
  executiveDecision?: {
    decision: 'Approved' | 'Approved with Conditions' | 'Needs Repair' | 'Blocked';
    releaseReadinessScore: number;
    summary: string;
    topBlockers: string[];
    topRepairs: string[];
    topOpportunities: string[];
    requiredNextActions: string[];
    lenses: ExecutiveCouncilLens[];
  };
}

export interface CouncilRunContext {
  project: AgentProject;
  targetScope: CouncilTargetScope;
  targetAgentId?: string;
  latestDailyReport?: DailyReport | null;
  savedDailyReports: DailyReport[];
  previousRuns: CouncilRun[];
}
