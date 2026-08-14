export type AgentOrigin = 'Codex' | 'Claude Code' | 'Hybrid' | 'Python' | 'Node' | 'Local' | 'Manual' | 'Other';

export type ProjectStatus = 'Ready' | 'Planning' | 'Building' | 'Needs QA' | 'Needs Attention' | 'Paused' | 'Archived' | 'Unknown';

export type ProjectPriority = 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown';

export type AgentStatus = 'Active' | 'Needs Configuration' | 'Paused' | 'Draft' | 'Archived' | ProjectStatus;

export type LaunchActionType =
  | 'url'
  | 'path'
  | 'command'
  | 'open_url'
  | 'open_repo'
  | 'open_folder'
  | 'open_file'
  | 'reveal_path'
  | 'run_command'
  | 'run_qa'
  | 'run_dry_run'
  | 'run_report'
  | 'copy_command'
  | 'copy_prompt'
  | 'staged_action';

export type DailyReportSignal = 'win' | 'risk' | 'next' | 'blocked' | 'metric';

export type ConnectorType =
  | 'github'
  | 'supabase'
  | 'netlify'
  | 'stripe'
  | 'custom'
  | 'local_folder'
  | 'local_config'
  | 'local_report_output'
  | 'test_command'
  | 'documentation'
  | 'website'
  | 'dashboard';

export type ConnectorStatus = 'connected' | 'needs_setup' | 'attention' | 'unknown';

export type ConnectorEnvironment = 'production' | 'staging' | 'development' | 'sandbox' | 'test' | 'live';

export interface LaunchAction {
  id: string;
  label: string;
  type: LaunchActionType;
  target: string;
  description: string;
  safetyNote?: string;
  expectedOutput?: string;
  safetyLevel?: 'safe' | 'review' | 'gated' | 'blocked';
}

export interface AgentDefinition {
  id: string;
  name: string;
  callsign: string;
  origin: AgentOrigin;
  role: string;
  status: AgentStatus;
  description: string;
  tags: string[];
  localPath?: string;
  repoUrl?: string;
  docsPath?: string;
  launchActions: LaunchAction[];
  qaCommands?: LaunchAction[];
  reportCommands?: LaunchAction[];
  safetyNotes?: string[];
}

export type AgentUnit = AgentDefinition;

export interface ProjectConnector {
  id: string;
  type: ConnectorType;
  label: string;
  url?: string;
  path?: string;
  command?: string;
  status: ConnectorStatus;
  description?: string;
  environment?: ConnectorEnvironment;
  lastChecked?: string;
  dataSource?: string;
  reason?: string;
  nextStep?: string;
}

export interface ProjectLocalPath {
  id: string;
  label: string;
  path: string;
  description?: string;
}

export interface ProjectRepoReference {
  id: string;
  label: string;
  url: string;
  description?: string;
}

export interface ProjectRepository {
  provider: 'github';
  url: string;
  label: string;
  reachability: 'verified' | 'unknown';
}

export type ProjectActivityType =
  | 'project_opened'
  | 'report_generated'
  | 'report_saved'
  | 'report_copied'
  | 'council_run'
  | 'connector_checked'
  | 'launch_action'
  | 'prompt_copied'
  | 'settings_viewed'
  | 'staged_action'
  | 'error';

export interface ProjectActivity {
  id: string;
  projectId: string;
  type: ProjectActivityType;
  message: string;
  createdAt: string;
  detail?: string;
}

export interface QwenChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface QwenConfigResult {
  ok: boolean;
  baseUrl: string;
  modelName: string;
  hasApiKey: boolean;
  timeoutMs: number;
  runtime?: {
    autostart: boolean;
    running: boolean;
    serverPath: string;
    modelPath: string;
    logPath: string;
  };
}

export interface QwenResult {
  ok: boolean;
  content?: string;
  baseUrl?: string;
  modelName?: string;
  error?: string;
}

export type QwenStreamEvent =
  | { type: 'phase'; phase: 'prompt-evaluating' }
  | { type: 'token'; token: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export interface ConnectorHealthCheck {
  connectorId: string;
  checkedAt: string;
  status: ConnectorStatus;
  reason: string;
  nextStep: string;
  dataSource: string;
}

export interface DailyReportItem {
  id: string;
  signal: DailyReportSignal;
  title: string;
  detail: string;
}

export interface DailyReport {
  id: string;
  projectId: string;
  generatedAt: string;
  title: string;
  executiveSummary: string;
  readinessScore: number;
  automationScore: number;
  riskScore: number;
  coverageScore: number;
  agentCount: number;
  connectorCount: number;
  connectedConnectorCount: number;
  setupNeededConnectorCount: number;
  attentionConnectorCount: number;
  agentPostureSummary: string;
  connectorPostureSummary: string;
  wins: DailyReportItem[];
  risks: DailyReportItem[];
  nextBestActions: DailyReportItem[];
  mentorTip: string;
  reportItems: DailyReportItem[];
  commanderNotes: string[];
  councilDecisionSummary?: string;
  councilTopRisk?: string;
  councilTopEngineeringRepair?: string;
  councilTopProductRecommendation?: string;
  councilTopMarketingRecommendation?: string;
  markdown: string;
}

export interface AgentProject {
  id: string;
  name: string;
  subtitle?: string;
  callsign: string;
  category: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  objective: string;
  missionBrief: string;
  customerNeed?: string;
  successCriteria?: string[];
  currentBlockers?: string[];
  repoUrl?: string;
  localPath?: string;
  accent: string;
  telemetry: {
    readiness: number;
    automation: number;
    risk: number;
    coverage: number;
  };
  tags: string[];
  connectors: ProjectConnector[];
  agents: AgentUnit[];
  launchActions: LaunchAction[];
  nextActions: string[];
  localPaths?: ProjectLocalPath[];
  repoReferences?: ProjectRepoReference[];
  safetyNotes?: string[];
  repository?: ProjectRepository;
  unknownFields?: string[];
}

declare global {
  interface Window {
    agentForce?: {
      openExternal: (target: string) => Promise<{ ok: boolean; error?: string }>;
      revealPath: (target: string) => Promise<{ ok: boolean; error?: string }>;
      runCommand: (command: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
      getPlatform: () => Promise<string>;
      qwenConfig: () => Promise<QwenConfigResult>;
      qwenHealth: () => Promise<QwenResult>;
      qwenChat: (messages: QwenChatMessage[]) => Promise<QwenResult>;
      qwenStreamChat: (
        requestId: string,
        messages: QwenChatMessage[],
        onEvent: (event: QwenStreamEvent) => void
      ) => () => void;
    };
  }
}
