import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  Bot,
  Brain,
  CheckCircle2,
  ChevronsRight,
  Clipboard,
  Command,
  Copy,
  CircleAlert,
  ExternalLink,
  FileText,
  FolderOpen,
  Gauge,
  Home,
  Layers,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  Orbit,
  Play,
  Radar,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  X,
  Zap
} from 'lucide-react';
import { seedProjects } from './data/seedProjects';
import { CouncilCenter, type CouncilCenterView } from './components/CouncilCenter';
import { QwenChatPanel } from './components/QwenChatPanel';
import { generateCouncilRun, summarizeCouncilRun } from './council/councilEngine';
import { safeReadCouncilRuns, safeWriteCouncilRuns } from './council/councilStorage';
import {
  getAgentDeckGuidance,
  getCouncilGuidance,
  getConnectorGuidance,
  getLaunchBayGuidance,
  getMentorGreeting,
  getProjectGuidance,
  getReportGuidance
} from './mentorEngine';
import { generateDailyReport } from './reportEngine';
import {
  getProjectReportStorageKey,
  safeReadActivity,
  safeReadConnectorHealth,
  safeReadJson,
  safeWriteActivity,
  safeWriteConnectorHealth,
  safeWriteJson
} from './storage';
import type { CouncilRun, CouncilTargetScope } from './council/councilTypes';
import type { AgentProject, ConnectorHealthCheck, DailyReport, LaunchAction, ProjectActivity, ProjectConnector } from './types';

type ProjectFilter =
  | 'all'
  | 'attention'
  | 'ready'
  | 'building'
  | 'missing_connectors'
  | 'council_findings'
  | 'no_daily_report'
  | 'high_risk'
  | 'critical_priority'
  | 'local_agent'
  | 'repo_connected';
type CockpitTab = 'overview' | 'agents' | 'connectors' | 'daily_report' | 'council' | 'launch_actions' | 'activity' | 'settings';
type CockpitTabBadgeMap = Partial<Record<CockpitTab, number>>;
type DrawerState =
  | { kind: 'mentor'; title: string }
  | { kind: 'connector'; title: string; connector: ProjectConnector }
  | { kind: 'launch'; title: string; action?: LaunchAction; agentName?: string }
  | { kind: 'agent'; title: string; agentId: string }
  | { kind: 'council_findings'; title: string }
  | null;

function App() {
  const appShellRef = useRef<HTMLElement | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(seedProjects[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<ProjectFilter>('all');
  const [launchBayStatus, setLaunchBayStatus] = useState('');
  const [councilRevision, setCouncilRevision] = useState(0);
  const [consoleLines, setConsoleLines] = useState<string[]>([
    'Agent FORCE systems online.',
    'Project Launch Bay loaded.',
    'Select an agent project to enter its cockpit.'
  ]);

  const selectedProject = seedProjects.find((project) => project.id === selectedProjectId) ?? null;
  const agentCount = seedProjects.reduce((total, project) => total + project.agents.length, 0);

  useEffect(() => {
    appShellRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [selectedProjectId]);
  const latestCouncilRuns = useMemo<Record<string, CouncilRun | null>>(() => {
    councilRevision;
    return Object.fromEntries(seedProjects.map((project) => [project.id, safeReadCouncilRuns(project.id)[0] ?? null]));
  }, [councilRevision]);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return seedProjects.filter((project) => {
      if (!projectMatchesFilter(project, quickFilter, latestCouncilRuns[project.id])) return false;
      if (!normalized) return true;

      const reports = readSavedReports(project.id);
      const council = latestCouncilRuns[project.id];
      const haystack = [
        project.name,
        project.callsign,
        project.category,
        project.objective,
        project.missionBrief,
        project.customerNeed ?? '',
        project.status,
        project.priority,
        project.repoUrl ?? '',
        project.localPath ?? '',
        council?.executiveDecision?.decision ?? 'no council run',
        reports.length ? 'daily report saved' : 'no daily report',
        ...project.tags,
        ...(project.currentBlockers ?? []),
        ...(project.successCriteria ?? []),
        ...(project.repoReferences ?? []).flatMap((repo) => [repo.label, repo.url, repo.description ?? '']),
        ...(project.localPaths ?? []).flatMap((localPath) => [localPath.label, localPath.path, localPath.description ?? '']),
        ...project.connectors.flatMap((connector) => [
          connector.label,
          connector.type,
          connector.status,
          connector.environment ?? '',
          connector.url ?? '',
          connector.path ?? '',
          connector.dataSource ?? '',
          connector.reason ?? '',
          connector.nextStep ?? '',
          connector.description ?? ''
        ]),
        ...project.agents.flatMap((agent) => [
          agent.name,
          agent.callsign,
          agent.origin,
          agent.role,
          agent.status,
          agent.localPath ?? '',
          agent.repoUrl ?? '',
          agent.docsPath ?? '',
          ...agent.tags,
          ...(agent.safetyNotes ?? [])
        ])
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [query, quickFilter, latestCouncilRuns]);

  async function handleLaunch(action: LaunchAction) {
    setConsoleLines((lines) => [`Launch requested: ${action.label}`, ...lines].slice(0, 8));

    if (action.type === 'copy_command' || action.type === 'copy_prompt') {
      const copied = await copyText(action.target);
      setConsoleLines((lines) => [
        copied ? `Copied launch payload: ${action.label}` : `Copy blocked: ${action.label}`,
        ...lines
      ].slice(0, 8));
      if (selectedProjectId) recordProjectActivity(selectedProjectId, 'launch_action', `Copied launch payload: ${action.label}`, action.description);
      return;
    }

    if (action.type === 'staged_action') {
      setConsoleLines((lines) => [`Staged action opened for review: ${action.label}`, ...lines].slice(0, 8));
      if (selectedProjectId) recordProjectActivity(selectedProjectId, 'staged_action', `Reviewed staged action: ${action.label}`, action.description);
      return;
    }

    if (!window.agentForce) {
      if (getLaunchKind(action.type) === 'command') {
        const copied = await copyText(action.target);
        setConsoleLines((lines) => [
          copied ? `Command copied for manual review: ${action.label}` : `Command launch unavailable: ${action.label}`,
          ...lines
        ].slice(0, 8));
        if (selectedProjectId) recordProjectActivity(selectedProjectId, 'staged_action', `Command staged for manual review: ${action.label}`, action.description);
        return;
      }
      window.open(action.target, '_blank', 'noopener,noreferrer');
      setConsoleLines((lines) => [`Browser fallback used for: ${action.label}`, ...lines].slice(0, 8));
      if (selectedProjectId) recordProjectActivity(selectedProjectId, 'launch_action', `Browser fallback used: ${action.label}`, action.target);
      return;
    }

    const launchKind = getLaunchKind(action.type);
    const launcher = {
      url: window.agentForce.openExternal,
      path: window.agentForce.revealPath,
      command: window.agentForce.runCommand
    }[launchKind];

    const result = await launcher(action.target);
    setConsoleLines((lines) => [
      result.ok ? `Launch success: ${action.label}` : `Launch blocked: ${result.error ?? action.label}`,
      ...lines
    ].slice(0, 8));
    if (selectedProjectId) {
      recordProjectActivity(
        selectedProjectId,
        result.ok ? 'launch_action' : 'error',
        result.ok ? `Launch success: ${action.label}` : `Launch blocked: ${action.label}`,
        result.error ?? action.target
      );
    }
  }

  return (
    <main className="app-shell" ref={appShellRef}>
      <div className="stars" />
      <div className="nebula nebula-one" />
      <div className="nebula nebula-two" />
      <div className="grid-horizon" />

      <header className="top-command-bar glass-panel">
        <button className="brand-lockup" onClick={() => setSelectedProjectId(null)} aria-label="Return to Project Launch Bay">
          <span className="brand-mark"><Orbit size={26} /></span>
          <span>
            <strong>Agent FORCE</strong>
            <small>Multi-Project Agent Launch Station</small>
          </span>
        </button>

        <div className="status-strip">
          <span><Activity size={15} /> {seedProjects.length} Projects</span>
          <span><Bot size={15} /> {agentCount} Agents</span>
          <span><ShieldCheck size={15} /> Command Gate Safe</span>
        </div>
      </header>

      {selectedProject ? (
        <ProjectCockpit
          project={selectedProject}
          onBack={() => setSelectedProjectId(null)}
          onSwitchProject={setSelectedProjectId}
          onLaunch={handleLaunch}
          consoleLines={consoleLines}
          latestCouncilRun={latestCouncilRuns[selectedProject.id] ?? null}
          onCouncilRunsChange={() => setCouncilRevision((value) => value + 1)}
        />
      ) : (
        <ProjectLaunchBay
          query={query}
          setQuery={setQuery}
          projects={filteredProjects}
          projectCount={seedProjects.length}
          agentCount={agentCount}
          onSelect={setSelectedProjectId}
          latestCouncilRuns={latestCouncilRuns}
          quickFilter={quickFilter}
          setQuickFilter={setQuickFilter}
          statusMessage={launchBayStatus}
          onClearSearch={() => {
            setQuery('');
            setQuickFilter('all');
            setLaunchBayStatus('Search and filters cleared.');
          }}
          onRefreshSignals={() => {
            setCouncilRevision((value) => value + 1);
            setLaunchBayStatus(`Fleet signals refreshed at ${new Date().toLocaleTimeString()}.`);
          }}
        />
      )}
    </main>
  );
}

function projectMatchesFilter(project: AgentProject, filter: ProjectFilter, latestCouncilRun?: CouncilRun | null) {
  const connectorIssue = project.connectors.some((connector) => connector.status === 'attention' || connector.status === 'needs_setup' || connector.status === 'unknown');
  const hasCouncilFindings = Boolean(latestCouncilRun?.findings.some((finding) => finding.status === 'open' || finding.status === 'in_progress'));
  const hasDailyReport = readSavedReports(project.id).length > 0;
  const hasLocalAgent = project.agents.some((agent) => agent.origin === 'Local' || agent.origin === 'Python' || agent.origin === 'Node' || Boolean(agent.localPath));
  const hasRepo = Boolean(project.repoUrl || project.repoReferences?.length || project.connectors.some((connector) => connector.type === 'github' && connector.url));

  if (filter === 'attention') return project.telemetry.risk >= 50 || project.telemetry.readiness < 60 || connectorIssue || hasCouncilFindings;
  if (filter === 'ready') return project.status === 'Ready';
  if (filter === 'building') return project.status === 'Building';
  if (filter === 'missing_connectors') return connectorIssue;
  if (filter === 'council_findings') return hasCouncilFindings;
  if (filter === 'no_daily_report') return !hasDailyReport;
  if (filter === 'high_risk') return project.telemetry.risk >= 50;
  if (filter === 'critical_priority') return project.priority === 'Critical';
  if (filter === 'local_agent') return hasLocalAgent;
  if (filter === 'repo_connected') return hasRepo;
  return true;
}

function getLaunchKind(type: LaunchAction['type']): 'url' | 'path' | 'command' {
  if (type === 'path' || type === 'open_folder' || type === 'open_file' || type === 'reveal_path') return 'path';
  if (type === 'command' || type === 'run_command' || type === 'run_qa' || type === 'run_dry_run' || type === 'run_report') return 'command';
  return 'url';
}

function makeActivity(projectId: string, type: ProjectActivity['type'], message: string, detail?: string): ProjectActivity {
  const createdAt = new Date().toISOString();
  return {
    id: `${projectId}-${type}-${createdAt}`,
    projectId,
    type,
    message,
    detail,
    createdAt
  };
}

function recordProjectActivity(projectId: string, type: ProjectActivity['type'], message: string, detail?: string) {
  const nextActivity = [makeActivity(projectId, type, message, detail), ...safeReadActivity(projectId)].slice(0, 40);
  safeWriteActivity(projectId, nextActivity);
  return nextActivity;
}

function tabForCharacterAction(actionLabel: string): CockpitTab {
  if (/launch/i.test(actionLabel)) return 'launch_actions';
  if (/connector/i.test(actionLabel)) return 'connectors';
  if (/daily|report/i.test(actionLabel)) return 'daily_report';
  if (/mentor/i.test(actionLabel)) return 'overview';
  return 'council';
}

function councilViewForCharacterAction(actionLabel: string): CouncilCenterView {
  if (/prompt|repair/i.test(actionLabel)) return 'prompt';
  if (/decision|approval|direction|product/i.test(actionLabel)) return 'decision';
  if (/report/i.test(actionLabel)) return 'report';
  return 'findings';
}

interface MentorGuideProps {
  eyebrow?: string;
  title?: string;
  guidance: string;
  compact?: boolean;
  onAsk?: () => void;
}

function MentorGuide({ eyebrow = 'Mentor Guidance', title = 'Agent FORCE', guidance, compact = false, onAsk }: MentorGuideProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className={`mentor-guide glass-panel ${compact ? 'mentor-compact' : ''} ${expanded ? 'mentor-expanded' : ''}`}>
      <div className="mentor-copy">
        <div className="eyebrow"><Brain size={15} /> {eyebrow}</div>
        <h3>{title}</h3>
        <p>{guidance}</p>
        {expanded && (
          <div className="mentor-expanded-copy">
            <strong>Guidance channel open.</strong>
            <span>Review the weakest telemetry signal, pick one concrete next action, and keep command launches gated until the cockpit is ready.</span>
          </div>
        )}
        <button className="mentor-ask" onClick={() => onAsk ? onAsk() : setExpanded((value) => !value)}>
          <MessageCircle size={15} /> Ask Mentor for Next Step
        </button>
      </div>
    </aside>
  );
}

interface ProjectLaunchBayProps {
  query: string;
  setQuery: (query: string) => void;
  projects: AgentProject[];
  projectCount: number;
  agentCount: number;
  onSelect: (projectId: string) => void;
  latestCouncilRuns: Record<string, CouncilRun | null>;
  quickFilter: ProjectFilter;
  setQuickFilter: (filter: ProjectFilter) => void;
  statusMessage: string;
  onClearSearch: () => void;
  onRefreshSignals: () => void;
}

function ProjectLaunchBay({
  query,
  setQuery,
  projects,
  projectCount,
  agentCount,
  onSelect,
  latestCouncilRuns,
  quickFilter,
  setQuickFilter,
  statusMessage,
  onClearSearch,
  onRefreshSignals
}: ProjectLaunchBayProps) {
  const filters: { id: ProjectFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'attention', label: 'Needs Attention' },
    { id: 'ready', label: 'Ready' },
    { id: 'building', label: 'Building' },
    { id: 'missing_connectors', label: 'Missing Connectors' },
    { id: 'council_findings', label: 'Council Findings' },
    { id: 'no_daily_report', label: 'No Daily Report' },
    { id: 'high_risk', label: 'High Risk' },
    { id: 'critical_priority', label: 'Critical Priority' },
    { id: 'local_agent', label: 'Local Agent Available' },
    { id: 'repo_connected', label: 'Repo Connected' }
  ];

  return (
    <section className="launch-bay page-stage">
      <div className="hero-panel glass-panel holo-border">
        <div className="launch-hero-layout">
          <div>
            <div className="eyebrow"><Sparkles size={16} /> Project Launch Bay</div>
            <h1>Choose your agent project.</h1>
            <p>{getMentorGreeting()}</p>
            <p>
              Operate every Codex, Claude Code, hybrid, and local agent from one desktop command hub. Each project gets its own cockpit, agents, launch actions, readiness telemetry, and mission plan.
            </p>
            <div className="search-console">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects, agents, tags, missions..."
                aria-label="Search agent projects"
              />
              {query && (
                <button type="button" onClick={onClearSearch} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="launch-filter-bar" aria-label="Project quick filters">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  className={quickFilter === filter.id ? 'active' : ''}
                  onClick={() => setQuickFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
              <button onClick={onRefreshSignals}><RefreshCw size={15} /> Refresh Fleet Signals</button>
            </div>
            {statusMessage && <div className="copy-status">{statusMessage}</div>}
          </div>
          <MentorGuide guidance={getLaunchBayGuidance(projectCount, agentCount)} compact />
        </div>
      </div>

      <FleetSituationWall projects={projects} latestCouncilRuns={latestCouncilRuns} />

      <div className="project-grid" aria-label="Agent projects">
        {projects.length ? projects.map((project) => (
          <button key={project.id} className={`project-card project-${project.accent}`} onClick={() => onSelect(project.id)}>
            <div className="project-card-inner">
              <div className="project-card-topline">
                <span className="callsign">{project.callsign}</span>
                <span className={`status-pill status-${project.status.toLowerCase().replace(/\s+/g, '-')}`}>{project.status}</span>
              </div>
              <h2>{project.name}</h2>
              <p>{project.objective}</p>
              <MiniTrendChart
                label="Mission signal"
                values={projectTrend(project)}
              />
              <div className="telemetry-row">
                <Metric label="Ready" value={project.telemetry.readiness} />
                <Metric label="Auto" value={project.telemetry.automation} />
                <Metric label="Cover" value={project.telemetry.coverage} />
              </div>
              <CouncilSignal run={latestCouncilRuns[project.id]} />
              <div className="project-card-intel">
                <span><strong>Risk</strong>{project.telemetry.risk}%</span>
                <span><strong>Priority</strong>{project.priority}</span>
                <span><strong>Report</strong>{readSavedReports(project.id).length ? 'Saved' : 'No daily report'}</span>
              </div>
              <div className="next-action-preview">
                <strong>Next:</strong> {getNextBestAction(project, latestCouncilRuns[project.id], readSavedReports(project.id), null).label}
              </div>
              <div className="tag-cloud">
                {project.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="project-card-footer">
                <span>{project.agents.length} agent{project.agents.length === 1 ? '' : 's'} / {project.connectors.length} connector{project.connectors.length === 1 ? '' : 's'}</span>
                <span className="enter-link">Enter cockpit <ChevronsRight size={16} /></span>
              </div>
            </div>
          </button>
        )) : (
          <div className="no-search-results glass-panel">
            <strong>No matching projects found.</strong>
            <span>Try searching by project name, callsign, connector, status, priority, tag, or agent role.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function CouncilSignal({ run }: { run?: CouncilRun | null }) {
  const summary = summarizeCouncilRun(run);

  return (
    <div className="council-card-signal" aria-label="Council readiness signal">
      <span>
        <strong>{run ? summary.decision : 'Council pending'}</strong>
        <small>{run ? `Ready ${summary.readiness}%` : 'Run review in cockpit'}</small>
      </span>
      <span>
        <strong>{summary.critical}</strong>
        <small>Critical</small>
      </span>
      <span>
        <strong>{summary.high}</strong>
        <small>High</small>
      </span>
    </div>
  );
}

interface ProjectCockpitProps {
  project: AgentProject;
  onBack: () => void;
  onSwitchProject: (projectId: string) => void;
  onLaunch: (action: LaunchAction) => void;
  consoleLines: string[];
  latestCouncilRun: CouncilRun | null;
  onCouncilRunsChange: () => void;
}

function isDailyReportArray(value: unknown): value is DailyReport[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const report = item as Partial<DailyReport>;
    return (
      typeof report.id === 'string'
      && typeof report.projectId === 'string'
      && typeof report.generatedAt === 'string'
      && typeof report.executiveSummary === 'string'
      && typeof report.markdown === 'string'
      && Array.isArray(report.wins)
      && Array.isArray(report.risks)
      && Array.isArray(report.nextBestActions)
      && Array.isArray(report.commanderNotes)
    );
  });
}

function readSavedReports(projectId: string): DailyReport[] {
  return safeReadJson<DailyReport[]>(getProjectReportStorageKey(projectId), [], isDailyReportArray);
}

function writeSavedReports(projectId: string, reports: DailyReport[]) {
  return safeWriteJson(getProjectReportStorageKey(projectId), reports.slice(0, 8));
}

function ProjectCockpit({ project, onBack, onSwitchProject, onLaunch, consoleLines, latestCouncilRun, onCouncilRunsChange }: ProjectCockpitProps) {
  const [currentReport, setCurrentReport] = useState<DailyReport | null>(null);
  const [savedReports, setSavedReports] = useState<DailyReport[]>([]);
  const [councilRuns, setCouncilRuns] = useState<CouncilRun[]>([]);
  const [copyStatus, setCopyStatus] = useState('');
  const [activeTab, setActiveTab] = useState<CockpitTab>('overview');
  const [requestedCouncilView, setRequestedCouncilView] = useState<CouncilCenterView>('findings');
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [toast, setToast] = useState('');
  const [connectorChecks, setConnectorChecks] = useState<Record<string, ConnectorHealthCheck>>({});
  const [activity, setActivity] = useState<ProjectActivity[]>([]);

  useEffect(() => {
    setCurrentReport(null);
    setSavedReports(readSavedReports(project.id));
    setCouncilRuns(safeReadCouncilRuns(project.id));
    setCopyStatus('');
    setActiveTab('overview');
    setRequestedCouncilView('findings');
    setDrawer(null);
    setToast('');
    setConnectorChecks(safeReadConnectorHealth(project.id));
    const opened = recordProjectActivity(project.id, 'project_opened', `Opened ${project.name}`, project.callsign);
    setActivity(opened);
  }, [project.id]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? '' : current), 4200);
  }

  function addActivity(type: ProjectActivity['type'], message: string, detail?: string) {
    const nextActivity = recordProjectActivity(project.id, type, message, detail);
    setActivity(nextActivity);
  }

  function handleGenerateReport() {
    const report = generateDailyReport(project, councilRuns[0] ?? latestCouncilRun);
    setCurrentReport(report);
    setCopyStatus('Daily report generated.');
    setActiveTab('daily_report');
    notify('Daily report generated and ready to copy or save.');
    addActivity('report_generated', 'Generated daily report', report.title);
  }

  async function handleCopyReport() {
    if (!currentReport) return;
    const copied = await copyText(currentReport.markdown);
    setCopyStatus(copied ? 'Markdown report copied.' : 'Copy blocked. Select the report text manually.');
    notify(copied ? 'Copied daily report to clipboard.' : 'Copy blocked. Select the report text manually.');
    addActivity(copied ? 'report_copied' : 'error', copied ? 'Copied daily report Markdown' : 'Daily report copy blocked', currentReport.title);
  }

  function handleSaveReport() {
    if (!currentReport) return;
    const nextReports = [currentReport, ...savedReports.filter((report) => report.id !== currentReport.id)].slice(0, 8);
    setSavedReports(nextReports);
    const saved = writeSavedReports(project.id, nextReports);
    setCopyStatus(saved ? 'Report saved to this project cockpit.' : 'Storage blocked. Report could not be saved locally.');
    notify(saved ? 'Report saved for this project.' : 'Storage blocked. Report could not be saved locally.');
    addActivity(saved ? 'report_saved' : 'error', saved ? 'Saved daily report' : 'Daily report save failed', currentReport.title);
  }

  function handleCouncilRun(targetScope: CouncilTargetScope, targetAgentId?: string) {
    const run = generateCouncilRun({
      project,
      targetScope,
      targetAgentId,
      latestDailyReport: currentReport,
      savedDailyReports: savedReports,
      previousRuns: councilRuns
    });
    const nextRuns = [run, ...councilRuns.filter((item) => item.id !== run.id)].slice(0, 12);
    setCouncilRuns(nextRuns);
    safeWriteCouncilRuns(project.id, nextRuns);
    onCouncilRunsChange();
    setActiveTab('council');
    notify(`Council review complete: ${run.executiveDecision?.decision ?? 'Pending'}.`);
    addActivity('council_run', `Council review complete: ${run.executiveDecision?.decision ?? 'Pending'}`, run.id);
    return run;
  }

  const currentCouncilRun = councilRuns[0] ?? latestCouncilRun;
  const nextBestAction = getNextBestAction(project, currentCouncilRun, savedReports, currentReport);
  const tabBadges = getCockpitTabBadges(project, currentCouncilRun, savedReports, connectorChecks, activity);

  function handleNextBestAction() {
    if (nextBestAction.effect === 'generate_report') {
      handleGenerateReport();
      return;
    }
    if (nextBestAction.effect === 'run_council') {
      handleCouncilRun('whole_project');
      return;
    }
    setActiveTab(nextBestAction.targetTab);
    notify(`Opened ${nextBestAction.label}.`);
  }

  function handleConnectorCheck(connector: ProjectConnector) {
    const hasReference = Boolean(connector.url || connector.path || connector.command);
    const issue = connector.status === 'connected'
      ? 'Connector reference is present. Live API health checks are staged for the next connector service pass.'
      : hasReference
        ? 'Connector needs review. Verify the safe reference and update status in the project registry.'
        : 'Missing reference. Add a non-secret repository, dashboard, local path, or documentation reference before treating this connector as ready.';
    const nextStep = hasReference ? 'Open the connector reference or configure metadata.' : 'Open Configure Connector and add a safe non-secret reference.';
    const checkedAt = new Date().toLocaleString();
    const check: ConnectorHealthCheck = {
      connectorId: connector.id,
      checkedAt,
      status: connector.status,
      reason: issue,
      nextStep,
      dataSource: hasReference ? 'Local metadata and safe reference check' : 'Local metadata check'
    };
    const nextChecks = {
      ...connectorChecks,
      [connector.id]: check
    };
    setConnectorChecks(nextChecks);
    safeWriteConnectorHealth(project.id, nextChecks);
    addActivity('connector_checked', `Checked connector: ${connector.label}`, nextStep);
    notify(`${connector.label} checked: ${nextStep}`);
  }

  async function handleCopyConnector(connector: ProjectConnector) {
    const copied = await copyText(connector.url ?? connector.path ?? connector.command ?? `${connector.label} has no reference configured.`);
    notify(copied ? `${connector.label} reference copied.` : 'Copy blocked. Select the reference manually.');
    addActivity(copied ? 'prompt_copied' : 'error', copied ? `Copied connector reference: ${connector.label}` : `Connector reference copy blocked: ${connector.label}`);
  }

  function handleOpenTab(tab: CockpitTab) {
    setActiveTab(tab);
    notify(`Opened ${tabLabel(tab)} tab.`);
  }

  function handleOpenCouncilView(view: CouncilCenterView) {
    setRequestedCouncilView(view);
    setActiveTab('council');
    notify(`Opened Council ${view.replace('_', ' ')} panel.`);
  }

  return (
    <section className="cockpit page-stage">
      <ActionToast message={toast} />
      <aside className="side-rail glass-panel">
        <button className="rail-home" onClick={onBack}><Home size={16} /> Launch Bay</button>
        <div className="rail-title">Project Fleet</div>
        {seedProjects.map((item) => (
          <button
            key={item.id}
            className={`rail-project ${item.id === project.id ? 'active' : ''}`}
            onClick={() => onSwitchProject(item.id)}
          >
            <span>{item.callsign}</span>
            <small>{item.name}</small>
          </button>
        ))}
      </aside>

      <div className="cockpit-main">
        <ProjectCommandHeader
          project={project}
          councilRun={currentCouncilRun}
          nextBestAction={nextBestAction}
          onPrimaryAction={handleNextBestAction}
        />

        <QwenChatPanel
          project={project}
          onActivity={(message, detail) => {
            addActivity(message.includes('failed') ? 'error' : 'launch_action', message, detail);
            notify(message);
          }}
        />

        <CockpitTabs activeTab={activeTab} onChange={handleOpenTab} badges={tabBadges} />

        <section className="tab-workspace" aria-live="polite">
          {activeTab === 'overview' && (
            <OverviewTab
              project={project}
              councilRun={currentCouncilRun}
              currentReport={currentReport}
              nextBestAction={nextBestAction}
              savedReports={savedReports}
              onNextBestAction={handleNextBestAction}
              onOpenTab={handleOpenTab}
              onOpenCouncilView={handleOpenCouncilView}
              onAskMentor={() => setDrawer({ kind: 'mentor', title: 'Mentor Recommendations' })}
            />
          )}

          {activeTab === 'agents' && (
            <AgentsTab
              project={project}
              onLaunch={onLaunch}
              onConfigure={(agentName) => setDrawer({ kind: 'launch', title: 'Add or Review Launch Actions', agentName })}
              onConfigureAgent={(agentId) => setDrawer({ kind: 'agent', title: 'Configure Agent', agentId })}
            />
          )}

          {activeTab === 'connectors' && (
            <ConnectorHub
              project={project}
              onLaunch={onLaunch}
              connectorChecks={connectorChecks}
              onCheck={handleConnectorCheck}
              onConfigure={(connector) => setDrawer({ kind: 'connector', title: 'Configure Connector', connector })}
              onCopyReference={handleCopyConnector}
            />
          )}

          {activeTab === 'daily_report' && (
            <DailyReportCenter
              project={project}
              report={currentReport}
              savedReports={savedReports}
              latestCouncilRun={currentCouncilRun}
              copyStatus={copyStatus}
              onGenerate={handleGenerateReport}
              onCopy={handleCopyReport}
              onSave={handleSaveReport}
              onOpenTab={handleOpenTab}
              onOpenCouncilView={handleOpenCouncilView}
              onSelectSaved={(report) => {
                setCurrentReport(report);
                notify('Saved daily report opened.');
                addActivity('report_generated', 'Opened saved daily report', report.title);
              }}
            />
          )}

          {activeTab === 'council' && (
            <CouncilCenter project={project} runs={councilRuns} onRun={handleCouncilRun} initialView={requestedCouncilView} />
          )}

          {activeTab === 'launch_actions' && (
            <LaunchActionsTab
              project={project}
              onLaunch={onLaunch}
              onConfigure={(action, agentName) => setDrawer({ kind: 'launch', title: 'Add or Review Launch Actions', action, agentName })}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityTab
              project={project}
              consoleLines={consoleLines}
              savedReports={savedReports}
              councilRuns={councilRuns}
              connectorChecks={connectorChecks}
              activity={activity}
              onOpenTab={handleOpenTab}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              project={project}
              onOpenTab={handleOpenTab}
              onNotify={(message) => {
                notify(message);
                addActivity('settings_viewed', message);
              }}
            />
          )}
        </section>
      </div>

      <aside className="right-console glass-panel">
        <h2><Terminal size={18} /> Context Panel</h2>
        <NextBestActionCard nextBestAction={nextBestAction} onAction={handleNextBestAction} compact />
        <h3>Mission Console</h3>
        <div className="console-feed compact-feed">
          {consoleLines.slice(0, 5).map((line, index) => <code key={`${line}-${index}`}>{line}</code>)}
        </div>
        <h3>Project Next Actions</h3>
        <ol>{project.nextActions.map((action) => <li key={action}>{action}</li>)}</ol>
      </aside>

      {drawer && (
        <ActionDrawer
          drawer={drawer}
          project={project}
          councilRun={currentCouncilRun}
          nextBestAction={nextBestAction}
          onClose={() => setDrawer(null)}
          onOpenTab={handleOpenTab}
          onNotify={notify}
        />
      )}
    </section>
  );
}

interface NextBestActionModel {
  label: string;
  reason: string;
  targetTab: CockpitTab;
  effect?: 'generate_report' | 'run_council';
}

function tabLabel(tab: CockpitTab) {
  return {
    overview: 'Overview',
    agents: 'Agents',
    connectors: 'Connectors',
    daily_report: 'Daily Report',
    council: 'Council',
    launch_actions: 'Launch Actions',
    activity: 'Activity',
    settings: 'Settings'
  }[tab];
}

function getConnectorHealth(project: AgentProject) {
  const attention = project.connectors.filter((connector) => connector.status === 'attention').length;
  const setup = project.connectors.filter((connector) => connector.status === 'needs_setup' || connector.status === 'unknown').length;
  const connected = project.connectors.filter((connector) => connector.status === 'connected').length;
  if (attention > 0) return `${attention} attention`;
  if (setup > 0) return `${setup} setup needed`;
  return `${connected}/${project.connectors.length || 0} connected`;
}

function getTopRisk(project: AgentProject, councilRun?: CouncilRun | null) {
  const critical = councilRun?.findings.find((finding) => finding.severity === 'Critical' || finding.severity === 'High');
  if (critical) return critical.title;
  const connector = project.connectors.find((item) => item.status === 'attention' || item.status === 'needs_setup' || item.status === 'unknown');
  if (connector) return `${connector.label}: ${connector.url ? 'review connector status' : 'missing URL'}`;
  if (project.telemetry.risk >= 50) return `Risk telemetry is ${project.telemetry.risk}%`;
  if (project.telemetry.readiness < 60) return `Readiness is ${project.telemetry.readiness}%`;
  return 'No major blocker detected';
}

function getNextBestAction(
  project: AgentProject,
  councilRun: CouncilRun | null | undefined,
  savedReports: DailyReport[],
  currentReport: DailyReport | null
): NextBestActionModel {
  const criticalHigh = councilRun?.findings.filter((finding) =>
    (finding.severity === 'Critical' || finding.severity === 'High')
    && (finding.status === 'open' || finding.status === 'in_progress')
  ).length ?? 0;
  const connectorIssue = project.connectors.some((connector) => connector.status === 'attention' || connector.status === 'needs_setup' || connector.status === 'unknown');
  const agentLaunchGap = project.agents.some((agent) => agent.launchActions.length === 0);

  if (criticalHigh > 0) {
    return {
      label: 'Open Council Findings',
      reason: `${criticalHigh} Critical/High Council finding${criticalHigh === 1 ? '' : 's'} need repair planning before release.`,
      targetTab: 'council'
    };
  }

  if (connectorIssue) {
    return {
      label: 'Review Connector Hub',
      reason: 'Connector posture is the clearest operating gap and affects reports, mentor guidance, and release confidence.',
      targetTab: 'connectors'
    };
  }

  if (!currentReport && savedReports.length === 0) {
    return {
      label: 'Generate Daily Report',
      reason: 'This project has no saved operating brief yet.',
      targetTab: 'daily_report',
      effect: 'generate_report'
    };
  }

  if (agentLaunchGap) {
    return {
      label: 'Add or Review Agent Launch Actions',
      reason: 'At least one agent has no launch path, so execution still requires manual hunting.',
      targetTab: 'agents'
    };
  }

  return {
    label: 'Run Final Council Review',
    reason: 'Core signals are stable enough for a fresh Council release-readiness pass.',
    targetTab: 'council',
    effect: 'run_council'
  };
}

function getCockpitTabBadges(
  project: AgentProject,
  councilRun: CouncilRun | null | undefined,
  savedReports: DailyReport[],
  connectorChecks: Record<string, ConnectorHealthCheck>,
  activity: ProjectActivity[]
): CockpitTabBadgeMap {
  const connectorAttention = project.connectors.filter((connector) =>
    connector.status === 'attention'
    || connector.status === 'needs_setup'
    || connector.status === 'unknown'
    || (!connector.url && !connector.path && !connector.command)
  ).length;
  const councilAttention = councilRun?.findings.filter((finding) =>
    (finding.severity === 'Critical' || finding.severity === 'High')
    && finding.status !== 'fixed'
    && finding.status !== 'retest_passed'
  ).length ?? 0;
  const agentConfiguration = project.agents.filter((agent) =>
    agent.launchActions.length === 0 || agent.status === 'Needs Configuration' || agent.status === 'Draft'
  ).length;
  const launchGap = project.launchActions.length === 0 ? 1 : 0;
  const uncheckedConnectors = project.connectors.filter((connector) => !connectorChecks[connector.id] && connector.status !== 'connected').length;

  return {
    agents: agentConfiguration,
    connectors: connectorAttention + uncheckedConnectors,
    daily_report: savedReports.length ? 0 : 1,
    council: councilAttention,
    launch_actions: launchGap,
    activity: activity.length ? 0 : 1,
    settings: project.safetyNotes?.length || project.repoReferences?.length || project.localPaths?.length ? 0 : 1
  };
}

function ProjectCommandHeader({
  project,
  councilRun,
  nextBestAction,
  onPrimaryAction
}: {
  project: AgentProject;
  councilRun: CouncilRun | null;
  nextBestAction: NextBestActionModel;
  onPrimaryAction: () => void;
}) {
  return (
    <section className={`project-command-header glass-panel holo-border project-${project.accent}`}>
      <div className="project-context-copy">
        <div className="eyebrow"><Radar size={16} /> {project.category} / {project.priority} Priority</div>
        <h1>{project.name}</h1>
        <p>{project.missionBrief}</p>
      </div>
      <div className="project-context-metrics">
        <Metric label="Ready" value={project.telemetry.readiness} />
        <span className="context-chip"><strong>{project.status}</strong><small>Status</small></span>
        <span className="context-chip"><strong>{getConnectorHealth(project)}</strong><small>Connectors</small></span>
        <span className="context-chip"><strong>{councilRun?.executiveDecision?.decision ?? 'No Council run'}</strong><small>Council</small></span>
      </div>
      <div className="next-action-strip">
        <span><strong>Top risk:</strong> {getTopRisk(project, councilRun)}</span>
        <button className="primary-action" onClick={onPrimaryAction}><Zap size={16} /> {nextBestAction.label}</button>
      </div>
    </section>
  );
}

function CockpitTabs({ activeTab, onChange, badges }: { activeTab: CockpitTab; onChange: (tab: CockpitTab) => void; badges: CockpitTabBadgeMap }) {
  const tabs: { id: CockpitTab; icon: ReactNode }[] = [
    { id: 'overview', icon: <LayoutDashboard size={15} /> },
    { id: 'agents', icon: <Bot size={15} /> },
    { id: 'connectors', icon: <ShieldCheck size={15} /> },
    { id: 'daily_report', icon: <FileText size={15} /> },
    { id: 'council', icon: <UserCheckIcon /> },
    { id: 'launch_actions', icon: <Play size={15} /> },
    { id: 'activity', icon: <Activity size={15} /> },
    { id: 'settings', icon: <Settings size={15} /> }
  ];

  return (
    <nav className="cockpit-tabs glass-panel" aria-label="Project cockpit workflows">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? 'active' : ''}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          <span>{tabLabel(tab.id)}</span>
          {Boolean(badges[tab.id]) && <i className="tab-badge" aria-label={`${badges[tab.id]} attention item${badges[tab.id] === 1 ? '' : 's'}`}>{badges[tab.id]}</i>}
        </button>
      ))}
    </nav>
  );
}

function UserCheckIcon() {
  return <CheckCircle2 size={15} />;
}

function OverviewTab({
  project,
  councilRun,
  currentReport,
  nextBestAction,
  savedReports,
  onNextBestAction,
  onOpenTab,
  onOpenCouncilView,
  onAskMentor
}: {
  project: AgentProject;
  councilRun: CouncilRun | null;
  currentReport: DailyReport | null;
  nextBestAction: NextBestActionModel;
  savedReports: DailyReport[];
  onNextBestAction: () => void;
  onOpenTab: (tab: CockpitTab) => void;
  onOpenCouncilView: (view: CouncilCenterView) => void;
  onAskMentor: () => void;
}) {
  return (
    <div className="overview-layout">
      <NextBestActionCard nextBestAction={nextBestAction} onAction={onNextBestAction} />
      <ProductReadinessPanel project={project} />
      <CockpitHudMatrix project={project} />
      <MentorGuide guidance={`${getProjectGuidance(project)} ${getCouncilGuidance(project, councilRun)}`} onAsk={onAskMentor} />
      <TopAttentionPanel project={project} councilRun={councilRun} onOpenTab={onOpenTab} />
      <section className="glass-panel command-card">
        <h2><Layers size={18} /> Recent Operating Signals</h2>
        <div className="signal-summary-grid">
          <span><strong>{savedReports.length}</strong><small>Saved reports</small></span>
          <span><strong>{councilRun?.findings.length ?? 0}</strong><small>Council findings</small></span>
          <span><strong>{project.launchActions.length}</strong><small>Project launch actions</small></span>
          <span><strong>{project.agents.length}</strong><small>Agent definitions</small></span>
        </div>
      </section>
    </div>
  );
}

function ProductReadinessPanel({ project }: { project: AgentProject }) {
  return (
    <section className="glass-panel command-card product-readiness-panel">
      <h2><ListChecks size={18} /> Product Clarity</h2>
      <div className="product-clarity-grid">
        <span><strong>Customer need</strong>{project.customerNeed ?? 'Define who this project helps and what decision it improves.'}</span>
        <span><strong>Current blocker</strong>{project.currentBlockers?.[0] ?? getTopRisk(project)}</span>
      </div>
      <h3>Success Criteria</h3>
      <ul>{(project.successCriteria ?? ['Define measurable success criteria for this project.']).map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function NextBestActionCard({ nextBestAction, onAction, compact = false }: { nextBestAction: NextBestActionModel; onAction: () => void; compact?: boolean }) {
  return (
    <section className={`next-best-action glass-panel ${compact ? 'next-best-compact' : ''}`}>
      <div>
        <div className="eyebrow"><Zap size={15} /> Next Best Action</div>
        <h2>{nextBestAction.label}</h2>
        <p>{nextBestAction.reason}</p>
      </div>
      <button className="primary-action" onClick={onAction}>{nextBestAction.label}</button>
    </section>
  );
}

function TopAttentionPanel({ project, councilRun, onOpenTab }: { project: AgentProject; councilRun: CouncilRun | null; onOpenTab: (tab: CockpitTab) => void }) {
  const items = [
    ...project.connectors
      .filter((connector) => connector.status === 'attention' || connector.status === 'needs_setup' || connector.status === 'unknown')
      .slice(0, 3)
      .map((connector) => ({ title: connector.label, detail: connector.url ? 'Review connector status and timestamp.' : 'Missing URL - configure connector.', tab: 'connectors' as CockpitTab })),
    ...(councilRun?.findings ?? [])
      .filter((finding) => finding.severity === 'Critical' || finding.severity === 'High')
      .slice(0, 3)
      .map((finding) => ({ title: finding.title, detail: finding.recommendedRepair, tab: 'council' as CockpitTab }))
  ].slice(0, 5);

  return (
    <section className="glass-panel command-card">
      <h2><CircleAlert size={18} /> Top Attention Items</h2>
      {items.length ? (
        <div className="attention-list">
          {items.map((item) => (
            <button key={`${item.tab}-${item.title}`} onClick={() => onOpenTab(item.tab)}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-state">No urgent attention items. Run a final Council review or generate the latest daily report.</p>
      )}
    </section>
  );
}

function AgentsTab({
  project,
  onLaunch,
  onConfigure,
  onConfigureAgent
}: {
  project: AgentProject;
  onLaunch: (action: LaunchAction) => void;
  onConfigure: (agentName: string) => void;
  onConfigureAgent: (agentId: string) => void;
}) {
  return (
    <section className="agent-deck">
      <div className="section-heading">
        <div>
          <div className="eyebrow"><Command size={15} /> Agent Deck</div>
          <h2>{project.callsign} units</h2>
        </div>
        <span>{project.agents.length} active definitions</span>
      </div>
      <MentorGuide guidance={getAgentDeckGuidance(project)} compact />
      {project.agents.length ? (
        <div className="agent-grid">
          {project.agents.map((agent) => (
            <article key={agent.id} className="agent-card glass-panel">
              <div className="agent-card-topline">
                <span className="callsign">{agent.callsign}</span>
                <span>{agent.origin}</span>
              </div>
              <h3>{agent.name}</h3>
              <strong>{agent.role}</strong>
              <p>{agent.description}</p>
              <div className="tag-cloud">{agent.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="agent-launch-actions">
                <button onClick={() => onConfigureAgent(agent.id)}><Bot size={15} /> Open Agent</button>
                {agent.localPath && <button onClick={() => onLaunch({ id: `${agent.id}-folder`, label: `Open ${agent.name} Folder`, type: 'open_folder', target: agent.localPath ?? '', description: `Open local folder for ${agent.name}.` })}><FolderOpen size={15} /> Open Folder</button>}
                {agent.docsPath && <button onClick={() => onLaunch({ id: `${agent.id}-docs`, label: `Open ${agent.name} Docs`, type: (agent.docsPath ?? '').startsWith('http') ? 'open_url' : 'open_file', target: agent.docsPath ?? '', description: `Open docs for ${agent.name}.` })}><FileText size={15} /> Open README/Docs</button>}
                {agent.repoUrl && <button onClick={() => onLaunch({ id: `${agent.id}-repo`, label: `Open ${agent.name} Repo`, type: 'open_repo', target: agent.repoUrl ?? '', description: `Open repository for ${agent.name}.` })}><ExternalLink size={15} /> Open Repo</button>}
                {agent.launchActions.map((action) => (
                  <button key={action.id} onClick={() => onLaunch(action)}><Play size={15} /> Open {action.label}</button>
                ))}
                {(agent.qaCommands?.length ? agent.qaCommands : [{ id: `${agent.id}-qa-staged`, label: 'Run QA', type: 'staged_action' as const, target: 'QA command not configured', description: 'QA execution is staged until this agent has a safe command or script reference.' }]).map((action) => (
                  <button key={action.id} onClick={() => onLaunch(action)}><ListChecks size={15} /> {action.label}</button>
                ))}
                {(agent.reportCommands?.length ? agent.reportCommands : [{ id: `${agent.id}-report-staged`, label: 'Run Report', type: 'staged_action' as const, target: 'Report command not configured', description: 'Report execution is staged until this agent has a safe report command or output path.' }]).map((action) => (
                  <button key={action.id} onClick={() => onLaunch(action)}><FileText size={15} /> {action.label}</button>
                ))}
                <button className="ghost-launch" onClick={() => onConfigure(agent.name)}><Settings size={15} /> Add or Review Launch Actions</button>
                <button className="ghost-launch" onClick={() => onConfigureAgent(agent.id)}><SlidersHorizontal size={15} /> Configure Agent</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state empty-panel">No agents configured yet. Add one focused operator so this project has a clear owner for execution.</p>
      )}
    </section>
  );
}

function LaunchActionsTab({ project, onLaunch, onConfigure }: { project: AgentProject; onLaunch: (action: LaunchAction) => void; onConfigure: (action?: LaunchAction, agentName?: string) => void }) {
  const agentActions = project.agents.flatMap((agent) => agent.launchActions.map((action) => ({ action, agentName: agent.name })));

  return (
    <section className="launch-actions-workflow glass-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow"><Play size={15} /> Launch Actions</div>
          <h2>Safe project and agent launch paths</h2>
        </div>
        <button className="primary-action" onClick={() => onConfigure()}><Settings size={16} /> Add or Review Launch Actions</button>
      </div>
      <p className="security-note">URL and path launch actions are allowed through Electron safety checks. Shell commands remain blocked unless `AGENT_FORCE_ALLOW_COMMANDS=true` is explicitly enabled.</p>
      <div className="launch-action-grid">
        {[...project.launchActions.map((action) => ({ action, agentName: 'Project' })), ...agentActions].map(({ action, agentName }) => (
          <article key={`${agentName}-${action.id}`} className="connector-card">
            <div className="connector-topline">
              <span className="connector-type">{action.type}</span>
              <span className="connector-status status-connected">{agentName}</span>
            </div>
            <h3>{action.label}</h3>
            <p>{action.description}</p>
            <div className="agent-launch-actions">
              <button onClick={() => onLaunch(action)}><Play size={15} /> Open Launch Action</button>
              <button onClick={() => onConfigure(action, agentName)}><Settings size={15} /> Review Configuration</button>
            </div>
          </article>
        ))}
        {project.launchActions.length + agentActions.length === 0 && (
          <p className="empty-state empty-panel">No launch actions configured. Add safe URLs or local paths so Ricky can move from status review to execution without hunting.</p>
        )}
      </div>
    </section>
  );
}

function ActivityTab({
  project,
  consoleLines,
  savedReports,
  councilRuns,
  connectorChecks,
  activity,
  onOpenTab
}: {
  project: AgentProject;
  consoleLines: string[];
  savedReports: DailyReport[];
  councilRuns: CouncilRun[];
  connectorChecks: Record<string, ConnectorHealthCheck>;
  activity: ProjectActivity[];
  onOpenTab: (tab: CockpitTab) => void;
}) {
  return (
    <section className="activity-workflow">
      <div className="glass-panel command-card">
        <h2><Terminal size={18} /> Mission Console</h2>
        <div className="console-feed">{consoleLines.map((line, index) => <code key={`${line}-${index}`}>{line}</code>)}</div>
      </div>
      <div className="activity-grid">
        <button onClick={() => onOpenTab('daily_report')}><FileText size={16} /> {savedReports.length} saved daily reports</button>
        <button onClick={() => onOpenTab('council')}><CheckCircle2 size={16} /> {councilRuns.length} Council runs</button>
        <button onClick={() => onOpenTab('connectors')}><ShieldCheck size={16} /> {Object.keys(connectorChecks).length} connector checks saved</button>
        <button onClick={() => onOpenTab('launch_actions')}><Play size={16} /> {project.launchActions.length} project launch actions</button>
      </div>
      <div className="glass-panel command-card activity-history-panel">
        <h2><Activity size={18} /> Project Activity</h2>
        {activity.length ? (
          <div className="activity-history">
            {activity.slice(0, 12).map((item) => (
              <article key={item.id}>
                <strong>{item.message}</strong>
                <span>{new Date(item.createdAt).toLocaleString()} / {item.type.replace(/_/g, ' ')}</span>
                {item.detail && <small>{item.detail}</small>}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Project activity will appear here after reports, Council reviews, connector checks, and launch actions.</p>
        )}
      </div>
    </section>
  );
}

function SettingsTab({ project, onOpenTab, onNotify }: { project: AgentProject; onOpenTab: (tab: CockpitTab) => void; onNotify: (message: string) => void }) {
  async function exportConfig() {
    const copied = await copyText(JSON.stringify(project, null, 2));
    onNotify(copied ? 'Project configuration copied as JSON.' : 'Copy blocked. Select project configuration manually.');
  }

  return (
    <section className="settings-workflow glass-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow"><Settings size={15} /> Project Settings</div>
          <h2>Project-scoped configuration</h2>
        </div>
        <button className="primary-action" onClick={exportConfig}><Copy size={16} /> Export Project Config</button>
      </div>
      <div className="settings-grid">
        <article className="report-section-card">
          <h3>Metadata</h3>
          <ul>
            <li><strong>Name:</strong> {project.name}</li>
            <li><strong>Callsign:</strong> {project.callsign}</li>
            <li><strong>Category:</strong> {project.category}</li>
            <li><strong>Status:</strong> {project.status}</li>
            <li><strong>Priority:</strong> {project.priority}</li>
          </ul>
        </article>
        <ReportList title="Safety Notes" items={project.safetyNotes ?? ['No project-level safety notes configured yet.']} />
        <ReportList title="Local Paths" items={(project.localPaths ?? []).map((path) => `${path.label}: ${path.path}`)} />
        <ReportList title="Repo References" items={(project.repoReferences ?? []).map((repo) => `${repo.label}: ${repo.url}`)} />
        <article className="report-section-card">
          <h3>Staged Editing</h3>
          <p className="empty-state">This version validates and exports project configuration. Durable editing is staged for the next registry editor pass; current source-backed changes live in `src/data/seedProjects.ts`.</p>
          <div className="agent-launch-actions">
            <button onClick={() => onOpenTab('connectors')}><ShieldCheck size={15} /> Review Connectors</button>
            <button onClick={() => onOpenTab('launch_actions')}><Play size={15} /> Review Launch Actions</button>
            <button onClick={() => onOpenTab('agents')}><Bot size={15} /> Review Agents</button>
          </div>
        </article>
      </div>
    </section>
  );
}

function ActionToast({ message }: { message: string }) {
  if (!message) return null;
  return <div className="action-toast" role="status"><CheckCircle2 size={16} /> {message}</div>;
}

function ActionDrawer({
  drawer,
  project,
  councilRun,
  nextBestAction,
  onClose,
  onOpenTab,
  onNotify
}: {
  drawer: NonNullable<DrawerState>;
  project: AgentProject;
  councilRun: CouncilRun | null;
  nextBestAction: NextBestActionModel;
  onClose: () => void;
  onOpenTab: (tab: CockpitTab) => void;
  onNotify: (message: string) => void;
}) {
  async function copyDrawerContext() {
    const agent = drawer.kind === 'agent' ? project.agents.find((item) => item.id === drawer.agentId) : null;
    const text = drawer.kind === 'connector'
      ? `${drawer.connector.label}\n${drawer.connector.url ?? 'Missing URL'}\n${drawer.connector.description ?? ''}`
      : drawer.kind === 'launch'
        ? `${drawer.agentName ?? 'Project'} launch action\n${drawer.action?.label ?? 'New action needed'}\n${drawer.action?.target ?? 'No target configured'}`
        : drawer.kind === 'agent'
          ? `${agent?.name ?? 'Agent'}\n${agent?.role ?? ''}\n${agent?.description ?? ''}`
        : `${project.name}\nNext best action: ${nextBestAction.label}\n${nextBestAction.reason}`;
    const copied = await copyText(text);
    onNotify(copied ? 'Panel context copied.' : 'Copy blocked. Select the panel text manually.');
  }

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true" aria-label={drawer.title}>
      <aside className="action-drawer glass-panel">
        <div className="drawer-header">
          <div>
            <div className="eyebrow"><SlidersHorizontal size={15} /> Action Panel</div>
            <h2>{drawer.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close action panel"><X size={18} /></button>
        </div>

        {drawer.kind === 'mentor' && (
          <div className="drawer-body">
            <p>{getProjectGuidance(project)} {getCouncilGuidance(project, councilRun)}</p>
            <NextBestActionCard nextBestAction={nextBestAction} onAction={() => { onOpenTab(nextBestAction.targetTab); onClose(); }} compact />
            <ReportList title="Current Blockers" items={project.currentBlockers ?? [getTopRisk(project, councilRun)]} />
          </div>
        )}

        {drawer.kind === 'connector' && (
          <div className="drawer-body">
            <div className="config-readout-grid">
              <span><strong>Connector</strong>{drawer.connector.label}</span>
              <span><strong>Type</strong>{drawer.connector.type}</span>
              <span><strong>Status</strong>{drawer.connector.status.replace('_', ' ')}</span>
              <span><strong>Environment</strong>{drawer.connector.environment ?? 'Not set'}</span>
              <span className="wide"><strong>Current Reference</strong>{drawer.connector.url ?? drawer.connector.path ?? drawer.connector.command ?? 'Missing reference - add a non-secret dashboard, repository, local path, documentation link, or staged command.'}</span>
            </div>
            <p className="security-note">Never store secrets, tokens, service keys, passwords, or private credentials in connector metadata. This panel stages safe metadata editing; update `src/data/seedProjects.ts` for durable changes in this version.</p>
            <button className="primary-action" onClick={() => { onOpenTab('connectors'); onClose(); }}><ShieldCheck size={16} /> Return to Connector Hub</button>
          </div>
        )}

        {drawer.kind === 'launch' && (
          <div className="drawer-body">
            <div className="config-readout-grid">
              <span><strong>Scope</strong>{drawer.agentName ?? 'Project-level action'}</span>
              <span><strong>Action</strong>{drawer.action?.label ?? 'New action needed'}</span>
              <span><strong>Type</strong>{drawer.action?.type ?? 'URL, path, or gated command'}</span>
              <span className="wide"><strong>Target</strong>{drawer.action?.target ?? 'No target configured yet.'}</span>
            </div>
            <p className="security-note">Use safe URLs or local paths for routine launch actions. Commands are intentionally blocked unless the environment explicitly opts in with `AGENT_FORCE_ALLOW_COMMANDS=true`.</p>
            <button className="primary-action" onClick={() => { onOpenTab('launch_actions'); onClose(); }}><Play size={16} /> Return to Launch Actions</button>
          </div>
        )}

        {drawer.kind === 'agent' && (
          <div className="drawer-body">
            {(() => {
              const agent = project.agents.find((item) => item.id === drawer.agentId);
              if (!agent) return <p className="empty-state">Agent definition was not found for this project.</p>;
              return (
                <>
                  <div className="config-readout-grid">
                    <span><strong>Agent</strong>{agent.name}</span>
                    <span><strong>Callsign</strong>{agent.callsign}</span>
                    <span><strong>Origin</strong>{agent.origin}</span>
                    <span><strong>Status</strong>{agent.status}</span>
                    <span className="wide"><strong>Role</strong>{agent.role}</span>
                    <span className="wide"><strong>Description</strong>{agent.description}</span>
                    <span><strong>Repo</strong>{agent.repoUrl ?? 'Not configured'}</span>
                    <span><strong>Docs</strong>{agent.docsPath ?? 'Not configured'}</span>
                    <span className="wide"><strong>Local path</strong>{agent.localPath ?? 'Not configured'}</span>
                  </div>
                  <ReportList title="Agent Safety Notes" items={agent.safetyNotes ?? ['No agent-specific safety notes configured yet.']} />
                  <p className="security-note">Agent editing is staged in this build. Add durable paths, repos, QA commands, report commands, and launch actions in `src/data/seedProjects.ts` until the registry editor ships.</p>
                  <button className="primary-action" onClick={() => { onOpenTab('agents'); onClose(); }}><Bot size={16} /> Return to Agents</button>
                </>
              );
            })()}
          </div>
        )}

        {drawer.kind === 'council_findings' && (
          <div className="drawer-body">
            <ReportList title="Critical and High Findings" items={(councilRun?.findings ?? []).filter((finding) => finding.severity === 'Critical' || finding.severity === 'High').map((finding) => `${finding.title}: ${finding.recommendedRepair}`)} />
          </div>
        )}

        <div className="drawer-actions">
          <button onClick={copyDrawerContext}><Copy size={16} /> Copy Panel Context</button>
          <button onClick={onClose}><CheckCircle2 size={16} /> Done</button>
        </div>
      </aside>
    </div>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="report-section-card">
      <h3>{title}</h3>
      {items.length ? (
        <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : (
        <p className="empty-state">No items for this section.</p>
      )}
    </article>
  );
}

function FleetSituationWall({ projects, latestCouncilRuns }: { projects: AgentProject[]; latestCouncilRuns: Record<string, CouncilRun | null> }) {
  const totalAgents = projects.reduce((total, project) => total + project.agents.length, 0);
  const totalConnectors = projects.reduce((total, project) => total + project.connectors.length, 0);
  const averageReadiness = Math.round(projects.reduce((total, project) => total + project.telemetry.readiness, 0) / Math.max(projects.length, 1));
  const attentionCount = projects.reduce(
    (total, project) => total + project.connectors.filter((connector) => connector.status === 'attention' || connector.status === 'needs_setup').length,
    0
  );
  const councilSummary = projects.reduce(
    (summary, project) => {
      const run = latestCouncilRuns[project.id];
      summary.critical += run?.findings.filter((finding) => finding.severity === 'Critical' && finding.status !== 'fixed' && finding.status !== 'retest_passed').length ?? 0;
      summary.high += run?.findings.filter((finding) => finding.severity === 'High' && finding.status !== 'fixed' && finding.status !== 'retest_passed').length ?? 0;
      if (!readSavedReports(project.id).length) summary.withoutReports += 1;
      if (run?.executiveDecision?.decision === 'Blocked' || run?.executiveDecision?.decision === 'Needs Repair') summary.needsRepair += 1;
      return summary;
    },
    { critical: 0, high: 0, withoutReports: 0, needsRepair: 0 }
  );

  return (
    <section className="fleet-situation-wall" aria-label="Fleet intelligence overview">
      <article className="hud-window hud-wide">
        <div className="hud-title"><Radar size={15} /> Fleet Signal</div>
        <MiniTrendChart label="Readiness waveform" values={projects.flatMap(projectTrend).slice(0, 18)} />
      </article>
      <article className="hud-window">
        <div className="hud-title"><Gauge size={15} /> Readiness</div>
        <strong>{averageReadiness}%</strong>
        <span>Average launch posture</span>
      </article>
      <article className="hud-window">
        <div className="hud-title"><Bot size={15} /> Operators</div>
        <strong>{totalAgents}</strong>
        <span>Mapped agent units</span>
      </article>
      <article className="hud-window">
        <div className="hud-title"><ShieldCheck size={15} /> Connectors</div>
        <strong>{totalConnectors}</strong>
        <span>{attentionCount} setup or attention</span>
      </article>
      <article className="hud-window">
        <div className="hud-title"><CircleAlert size={15} /> Council Risk</div>
        <strong>{councilSummary.critical}/{councilSummary.high}</strong>
        <span>Critical / High open findings</span>
      </article>
      <article className="hud-window">
        <div className="hud-title"><FileText size={15} /> Reports</div>
        <strong>{councilSummary.withoutReports}</strong>
        <span>Projects without saved reports</span>
      </article>
      <article className="hud-window hud-map">
        <div className="hud-title"><Orbit size={15} /> Mission Map</div>
        <WorldGrid />
      </article>
    </section>
  );
}

function CockpitHudMatrix({ project }: { project: AgentProject }) {
  const connected = project.connectors.filter((connector) => connector.status === 'connected').length;
  const actionCount = project.launchActions.length + project.agents.reduce((total, agent) => total + agent.launchActions.length, 0);

  return (
    <section className="cockpit-hud-matrix" aria-label={`${project.name} command analytics`}>
      <article className="hud-window command-map-panel">
        <div className="hud-title"><Orbit size={15} /> Global Mission Grid</div>
        <WorldGrid />
        <div className="map-readout">
          <span>{project.callsign}</span>
          <strong>{project.status}</strong>
        </div>
      </article>
      <article className="hud-window">
        <div className="hud-title"><Activity size={15} /> Telemetry Spectrum</div>
        <SignalBars values={[project.telemetry.readiness, project.telemetry.automation, 100 - project.telemetry.risk, project.telemetry.coverage, connected * 24, actionCount * 18]} />
      </article>
      <article className="hud-window">
        <div className="hud-title"><Gauge size={15} /> Command Dials</div>
        <div className="dial-row">
          <Metric label="Ready" value={project.telemetry.readiness} />
          <Metric label="Auto" value={project.telemetry.automation} />
          <Metric label="Risk" value={project.telemetry.risk} />
        </div>
      </article>
      <article className="hud-window hud-wide">
        <div className="hud-title"><ShieldCheck size={15} /> Infrastructure Stream</div>
        <div className="connector-stream">
          {project.connectors.map((connector) => (
            <span key={connector.id} className={`stream-node status-${connector.status}`}>
              {connector.type} / {connector.status.replace('_', ' ')}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}

function projectTrend(project: AgentProject) {
  const { readiness, automation, risk, coverage } = project.telemetry;
  return [
    Math.max(18, readiness - 18),
    automation,
    Math.max(12, 100 - risk),
    coverage,
    Math.min(98, readiness + project.agents.length * 3),
    Math.min(98, coverage + project.connectors.filter((connector) => connector.status === 'connected').length * 6)
  ];
}

function MiniTrendChart({ label, values }: { label: string; values: number[] }) {
  const width = 280;
  const height = 80;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - (Math.max(0, Math.min(100, value)) / 100) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="mini-trend" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <polyline points={points} />
        <polygon points={`0,${height} ${points} ${width},${height}`} />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function SignalBars({ values }: { values: number[] }) {
  return (
    <div className="signal-bars" aria-label="Signal bar chart">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} style={{ height: `${Math.max(12, Math.min(100, value))}%` }} />
      ))}
    </div>
  );
}

function WorldGrid() {
  return (
    <div className="world-grid" aria-hidden="true">
      <span className="continent continent-a" />
      <span className="continent continent-b" />
      <span className="continent continent-c" />
      <span className="continent continent-d" />
      <i className="map-dot dot-a" />
      <i className="map-dot dot-b" />
      <i className="map-dot dot-c" />
    </div>
  );
}

function ConnectorHub({
  project,
  onLaunch,
  connectorChecks = {},
  onCheck,
  onConfigure,
  onCopyReference
}: {
  project: AgentProject;
  onLaunch: (action: LaunchAction) => void;
  connectorChecks?: Record<string, ConnectorHealthCheck>;
  onCheck?: (connector: ProjectConnector) => void;
  onConfigure?: (connector: ProjectConnector) => void;
  onCopyReference?: (connector: ProjectConnector) => void;
}) {
  const connected = project.connectors.filter((connector) => connector.status === 'connected').length;
  const needsSetup = project.connectors.filter((connector) => connector.status === 'needs_setup' || connector.status === 'unknown').length;
  const attention = project.connectors.filter((connector) => connector.status === 'attention').length;

  function openConnector(connector: ProjectConnector) {
    const target = connector.url ?? connector.path ?? connector.command;
    if (!target) {
      onConfigure?.(connector);
      return;
    }
    onLaunch({
      id: `connector-${connector.id}`,
      label: `Open ${connector.label}`,
      type: connector.command ? 'run_command' : connector.path ? 'reveal_path' : 'open_url',
      target,
      description: connector.description ?? `Open ${connector.label}`
    });
  }

  return (
    <section className="connector-hub glass-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow"><ShieldCheck size={15} /> Connector Hub</div>
          <h2>Project infrastructure</h2>
        </div>
        <span>{connected} connected / {needsSetup} setup / {attention} attention</span>
      </div>
      <MentorGuide guidance={getConnectorGuidance(project)} compact />
      {project.connectors.length ? (
        <div className="connector-grid">
          {project.connectors.map((connector) => (
            <article key={connector.id} className={`connector-card connector-${connector.status}`}>
              <div className="connector-topline">
                <span className="connector-type">{connector.type}</span>
                <span className={`connector-status status-${connector.status}`}>{connector.status.replace('_', ' ')}</span>
              </div>
              <h3>{connector.label}</h3>
              <p>{connector.description ?? 'No connector description provided.'}</p>
              <div className="connector-meta">
                <span>Environment: {connector.environment ?? 'not set'}</span>
                <span>{connectorChecks[connector.id]?.checkedAt ? `Checked: ${connectorChecks[connector.id].checkedAt}` : connector.lastChecked ? `Checked: ${connector.lastChecked}` : 'Reference only - no live check yet'}</span>
                <span>{connectorChecks[connector.id]?.reason ?? (connector.status === 'connected' ? 'Reference is mapped.' : connector.url || connector.path || connector.command ? 'Review setup and status.' : 'Missing reference - configure connector.')}</span>
                <span>{connectorChecks[connector.id]?.nextStep ?? (connector.url || connector.path || connector.command ? 'Open or check this connector.' : 'Add a non-secret URL, path, or staged command reference.')}</span>
              </div>
              <div className="connector-actions">
                <button onClick={() => openConnector(connector)} aria-label={`Open ${connector.label}`}>
                  <ExternalLink size={15} /> {connector.url || connector.path || connector.command ? 'Open Connector' : 'Configure Missing Reference'}
                </button>
                <button onClick={() => onCheck?.(connector)}><RefreshCw size={15} /> Check Now</button>
                <button onClick={() => onConfigure?.(connector)}><Settings size={15} /> Configure Connector</button>
                <button onClick={() => onCopyReference?.(connector)}><Copy size={15} /> Copy Reference</button>
              </div>
              {!connector.url && !connector.path && !connector.command && (
                <div className="setup-needed">Missing reference: configure a non-secret dashboard, repository, local path, documentation link, or staged command before treating this connector as ready.</div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state empty-panel">No connectors configured. Add non-secret references for GitHub, Netlify, Supabase, Stripe, or custom systems.</p>
      )}
      <p className="security-note">Connector metadata is reference-only. Never store tokens, API keys, passwords, service-role keys, or private credentials here.</p>
    </section>
  );
}

interface DailyReportCenterProps {
  project: AgentProject;
  report: DailyReport | null;
  savedReports: DailyReport[];
  latestCouncilRun: CouncilRun | null;
  copyStatus: string;
  onGenerate: () => void;
  onCopy: () => void;
  onSave: () => void;
  onOpenTab: (tab: CockpitTab) => void;
  onOpenCouncilView: (view: CouncilCenterView) => void;
  onSelectSaved: (report: DailyReport) => void;
}

function DailyReportCenter({
  project,
  report,
  savedReports,
  latestCouncilRun,
  copyStatus,
  onGenerate,
  onCopy,
  onSave,
  onOpenTab,
  onOpenCouncilView,
  onSelectSaved
}: DailyReportCenterProps) {
  const generatedDate = report ? new Date(report.generatedAt).toLocaleString() : 'Awaiting generation';
  const [reportUiStatus, setReportUiStatus] = useState('');
  return (
    <section className="daily-report-center glass-panel holo-border">
      <div className="report-header">
        <div>
          <div className="eyebrow"><FileText size={15} /> Daily Mission Report</div>
          <h2>Daily Report Center</h2>
          <p>{project.callsign} / {generatedDate}</p>
        </div>
        <div className="report-actions">
          <button className="primary-action" onClick={onGenerate}><Sparkles size={16} /> Generate Daily Report</button>
          <button onClick={onCopy} disabled={!report}><Clipboard size={16} /> Copy Report</button>
          <button onClick={onSave} disabled={!report}><Save size={16} /> Save Report</button>
          <button onClick={() => {
            document.getElementById(`recent-reports-${project.id}`)?.scrollIntoView({ block: 'nearest' });
            setReportUiStatus('Recent project reports opened.');
          }}><FileText size={16} /> View Recent Reports</button>
          <button onClick={() => {
            onCopy();
            setReportUiStatus('Markdown export copied when a report is available.');
          }} disabled={!report}><Copy size={16} /> Export Markdown</button>
        </div>
      </div>

      <MentorGuide eyebrow="Mentor Tip" guidance={getReportGuidance(project, report)} compact />

      {latestCouncilRun && (
        <div className="daily-council-brief">
          <div className="recent-reports-heading">
            <strong>Latest Council Signal</strong>
            <span>{latestCouncilRun.executiveDecision?.decision ?? 'Pending'} / Ready {latestCouncilRun.executiveDecision?.releaseReadinessScore ?? 0}%</span>
          </div>
          <div className="daily-council-grid">
            <span><strong>Top QA Risk</strong>{latestCouncilRun.findings[0]?.title ?? 'No open QA findings.'}</span>
            <span><strong>Top Engineering Repair</strong>{latestCouncilRun.engineeringRepairs[0] ?? 'No engineering repair queued.'}</span>
            <span><strong>Product Recommendation</strong>{latestCouncilRun.productDirection[0] ?? 'No product direction queued.'}</span>
            <span><strong>Marketing Recommendation</strong>{latestCouncilRun.marketingDirection[0] ?? 'No marketing direction queued.'}</span>
          </div>
        </div>
      )}

      {(copyStatus || reportUiStatus) && <div className="copy-status">{reportUiStatus || copyStatus}</div>}

      {report ? (
        <>
          <article className="executive-summary-card">
            <span>Executive Summary</span>
            <p>{report.executiveSummary}</p>
          </article>

          <div className="report-score-grid">
            <Metric label="Readiness" value={report.readinessScore} />
            <Metric label="Automation" value={report.automationScore} />
            <Metric label="Risk" value={report.riskScore} />
            <Metric label="Coverage" value={report.coverageScore} />
          </div>

          <div className="agent-posture-card">
            <strong>Connector posture summary</strong>
            <p>{report.connectorPostureSummary || 'Connector posture was not captured in this saved report version.'}</p>
          </div>

          <div className="agent-posture-card">
            <strong>Agent posture summary</strong>
            <p>{report.agentPostureSummary}</p>
          </div>

          <div className="report-section-grid">
            <ReportSection title="Mission Progress" items={report.wins} />
            <ReportSection title="Risk & Blockers" items={report.risks} />
            <ReportSection title="Next Best Actions" items={report.nextBestActions} />
          </div>

          <div className="commander-notes">
            <strong>Commander Notes</strong>
            <ul>{report.commanderNotes.map((note) => <li key={note}>{note}</li>)}</ul>
          </div>
        </>
      ) : (
        <div className="report-empty-state">
          <strong>No daily report generated yet.</strong>
          <span>Generate a project-specific operating brief from mission data, telemetry, agents, launch actions, and next actions.</span>
        </div>
      )}

      <div className="recent-reports" id={`recent-reports-${project.id}`}>
        <div className="recent-reports-heading">
          <strong>Recent Reports</strong>
          <span>{savedReports.length} saved for this project</span>
        </div>
        {savedReports.length ? (
          <div className="recent-report-list">
            {savedReports.map((saved) => (
              <button key={saved.id} onClick={() => onSelectSaved(saved)}>
                <strong>{new Date(saved.generatedAt).toLocaleDateString()}</strong>
                <span>{new Date(saved.generatedAt).toLocaleTimeString()} / Ready {saved.readinessScore}% / Risk {saved.riskScore}%</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">Saved daily reports will appear here for {project.callsign} only.</p>
        )}
      </div>
    </section>
  );
}

function ReportSection({ title, items }: { title: string; items: DailyReport['reportItems'] }) {
  return (
    <article className="report-section-card">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="metric-chip">
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function Telemetry({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const display = inverse ? 100 - value : value;
  return (
    <div className="telemetry-bar">
      <div className="telemetry-label"><span>{label}</span><strong>{value}%</strong></div>
      <div className="bar-track"><span style={{ width: `${display}%` }} /></div>
    </div>
  );
}

export default App;
