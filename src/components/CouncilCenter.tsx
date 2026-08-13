import { useEffect, useMemo, useState } from 'react';
import {
  Clipboard,
  FileText,
  GitBranch,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { councilAgents } from '../council/councilAgents';
import { scopeLabel, summarizeCouncilRun } from '../council/councilEngine';
import { getFindingCharacterId } from '../characters/characterEngine';
import { getCharacterById } from '../characters/characterRegistry';
import { CharacterAvatar } from './CharacterAvatar';
import { CharacterCouncilChamber } from './CharacterCouncilChamber';
import type {
  CouncilAgent,
  CouncilFinding,
  CouncilFindingSeverity,
  CouncilRun,
  CouncilTargetScope
} from '../council/councilTypes';
import type { AgentProject } from '../types';

const scopeOptions: { value: CouncilTargetScope; label: string }[] = [
  { value: 'whole_project', label: 'Whole project' },
  { value: 'agent', label: 'Specific agent' },
  { value: 'connector_hub', label: 'Connector hub' },
  { value: 'daily_report_center', label: 'Daily report center' },
  { value: 'launch_actions', label: 'Launch actions' },
  { value: 'ux_ui', label: 'UX/UI' },
  { value: 'marketing_brand', label: 'Marketing/SEO/brand' }
];

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

function severityClass(severity: CouncilFindingSeverity) {
  return `severity-${severity.toLowerCase()}`;
}

function findingOwnerCount(agent: CouncilAgent, findings: CouncilFinding[]) {
  return findings.filter((finding) => finding.assignedTo === agent.role).length;
}

function agentFindingCount(agent: CouncilAgent, findings: CouncilFinding[]) {
  return findings.filter((finding) => finding.agentId === agent.id).length;
}

interface CouncilCenterProps {
  project: AgentProject;
  runs: CouncilRun[];
  onRun: (targetScope: CouncilTargetScope, targetAgentId?: string) => CouncilRun;
  initialView?: CouncilCenterView;
}

export type CouncilCenterView = 'findings' | 'decision' | 'report' | 'prompt';

export function CouncilCenter({ project, runs, onRun, initialView = 'findings' }: CouncilCenterProps) {
  const [targetScope, setTargetScope] = useState<CouncilTargetScope>('whole_project');
  const [targetAgentId, setTargetAgentId] = useState(project.agents[0]?.id ?? '');
  const [activeView, setActiveView] = useState<CouncilCenterView>(initialView);
  const [copyStatus, setCopyStatus] = useState('');
  const latestRun = runs[0] ?? null;
  const summary = summarizeCouncilRun(latestRun);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  const findingsBySeverity = useMemo(() => {
    const findings = latestRun?.findings ?? [];
    return ['Critical', 'High', 'Medium', 'Low'].map((severity) => ({
      severity: severity as CouncilFindingSeverity,
      count: findings.filter((finding) => finding.severity === severity).length
    }));
  }, [latestRun]);

  function runCouncil() {
    const nextRun = onRun(targetScope, targetScope === 'agent' ? targetAgentId : undefined);
    setCopyStatus(`Council review completed: ${nextRun.executiveDecision?.decision ?? 'Pending'}.`);
    setActiveView('findings');
  }

  function handleCharacterAction(characterId: string) {
    if (characterId === 'princess-leia') {
      setActiveView('findings');
      setCopyStatus(latestRun ? 'QA findings opened for Princess Leia.' : 'Run Council Review before viewing QA findings.');
      return;
    }
    if (characterId === 'luke-skywalker') {
      setActiveView('prompt');
      setCopyStatus(latestRun ? 'Codex repair prompt opened for Luke Skywalker.' : 'Run Council Review before generating a repair prompt.');
      return;
    }
    if (characterId === 'chewmacka') {
      setActiveView('decision');
      setCopyStatus(latestRun ? 'Brand and SEO recommendations are visible in the executive decision.' : 'Run Council Review before viewing brand recommendations.');
      return;
    }
    if (characterId === 'han-solo') {
      setActiveView('decision');
      setCopyStatus(latestRun ? 'Product direction opened for Han Solo.' : 'Run Council Review before viewing product direction.');
      return;
    }
    setActiveView('decision');
    setCopyStatus(latestRun ? 'CEO decision opened.' : 'Run Council Review before viewing the final decision.');
  }

  async function copyCouncilReport() {
    if (!latestRun) return;
    const copied = await copyText(latestRun.councilReportMarkdown);
    setCopyStatus(copied ? 'Council report copied as Markdown.' : 'Copy blocked. Select the report text manually.');
  }

  async function copyCodexPrompt() {
    if (!latestRun) return;
    const copied = await copyText(latestRun.codexPrompt);
    setCopyStatus(copied ? 'Codex repair prompt copied.' : 'Copy blocked. Select the prompt text manually.');
  }

  return (
    <section className="council-center glass-panel holo-border">
      <div className="council-header">
        <div>
          <div className="eyebrow"><UserCheck size={15} /> Agent FORCE Council</div>
          <h2>Reusable expert review board</h2>
          <p>
            Deterministic local review for QA, engineering repairs, marketing clarity, product direction, and executive release readiness.
          </p>
        </div>
        <div className="council-readiness">
          <strong>{summary.readiness}%</strong>
          <span>{summary.decision}</span>
        </div>
      </div>

      <div className="council-controls">
        <label>
          <span>Target scope</span>
          <select value={targetScope} onChange={(event) => setTargetScope(event.target.value as CouncilTargetScope)}>
            {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {targetScope === 'agent' && (
          <label>
            <span>Target agent</span>
            <select value={targetAgentId} onChange={(event) => setTargetAgentId(event.target.value)}>
              {project.agents.length ? project.agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.callsign} - {agent.name}</option>
              )) : <option value="">No project agents configured</option>}
            </select>
          </label>
        )}
        <button className="primary-action" onClick={runCouncil}><Play size={16} /> Run Council Review</button>
        <button onClick={runCouncil}><RefreshCw size={16} /> Retest</button>
        <button onClick={() => setActiveView('findings')} disabled={!latestRun}><ShieldAlert size={16} /> View Findings</button>
        <button onClick={() => setActiveView('decision')} disabled={!latestRun}><UserCheck size={16} /> View Executive Decision</button>
        <button onClick={copyCouncilReport} disabled={!latestRun}><FileText size={16} /> Export Council Report</button>
        <button onClick={() => {
          setActiveView('prompt');
          setCopyStatus(latestRun ? 'Codex repair prompt generated in the prompt panel.' : 'Run Council Review before generating a prompt.');
        }} disabled={!latestRun}><Sparkles size={16} /> Generate Codex Repair Prompt</button>
        <button onClick={copyCodexPrompt} disabled={!latestRun}><Clipboard size={16} /> Copy Codex Prompt</button>
      </div>

      {copyStatus && <div className="copy-status">{copyStatus}</div>}

      <div className="council-summary-grid">
        {findingsBySeverity.map((item) => (
          <span key={item.severity} className={`severity-chip ${severityClass(item.severity)}`}>
            <strong>{item.count}</strong>
            <small>{item.severity}</small>
          </span>
        ))}
        <span className="severity-chip">
          <strong>{summary.open}</strong>
          <small>Open</small>
        </span>
      </div>

      <CharacterCouncilChamber run={latestRun} onCharacterAction={handleCharacterAction} />

      <div className="council-agent-grid">
        {councilAgents.map((agent) => (
          <article key={agent.id} className="council-agent-card">
            <div className={`council-agent-badge badge-${agent.role}`} aria-hidden="true">
              {agent.role === 'qa_optimizer' && <ShieldAlert size={19} />}
              {agent.role === 'software_engineer' && <GitBranch size={19} />}
              {agent.role === 'marketing_executive' && <Sparkles size={19} />}
              {agent.role === 'chief_product_officer' && <UserCheck size={19} />}
              {agent.role === 'chief_executive_officer' && <FileText size={19} />}
            </div>
            <div>
              <span>{agent.title}</span>
              <h3>{agent.name}</h3>
              <p>{agent.mission}</p>
            </div>
            <div className="council-agent-stats">
              <strong>{agentFindingCount(agent, latestRun?.findings ?? [])} findings</strong>
              <strong>{findingOwnerCount(agent, latestRun?.findings ?? [])} repairs</strong>
              <strong>{latestRun ? latestRun.status.replace('_', ' ') : 'not started'}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="council-view-tabs" role="tablist" aria-label="Council review views">
        <button className={activeView === 'findings' ? 'active' : ''} onClick={() => setActiveView('findings')}>Findings</button>
        <button className={activeView === 'decision' ? 'active' : ''} onClick={() => setActiveView('decision')}>Executive Decision</button>
        <button className={activeView === 'report' ? 'active' : ''} onClick={() => setActiveView('report')}>Council Report</button>
        <button className={activeView === 'prompt' ? 'active' : ''} onClick={() => setActiveView('prompt')}>Codex Prompt</button>
      </div>

      {!latestRun ? (
        <div className="report-empty-state">
          <strong>No Council run yet.</strong>
          <span>Run the Council to generate project-scoped findings, a CEO decision, a Markdown report, and a Codex repair prompt.</span>
        </div>
      ) : (
        <div className="council-workspace">
          {activeView === 'findings' && <CouncilFindings findings={latestRun.findings} />}
          {activeView === 'decision' && <CouncilDecision run={latestRun} />}
          {activeView === 'report' && <pre>{latestRun.councilReportMarkdown}</pre>}
          {activeView === 'prompt' && <pre>{latestRun.codexPrompt}</pre>}
        </div>
      )}

      <div className="council-history">
        <div className="recent-reports-heading">
          <strong>Recent Council Runs</strong>
          <span>{runs.length} saved for {project.callsign}</span>
        </div>
        {runs.length ? (
          <div className="council-run-list">
            {runs.slice(0, 5).map((run) => (
              <article key={run.id}>
                <strong>{new Date(run.startedAt).toLocaleString()}</strong>
                <span>{scopeLabel(run.targetScope)} / {run.executiveDecision?.decision ?? 'Pending'} / Ready {run.executiveDecision?.releaseReadinessScore ?? 0}%</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Council history is stored locally and scoped only to this project.</p>
        )}
      </div>
    </section>
  );
}

function CouncilFindings({ findings }: { findings: CouncilFinding[] }) {
  if (!findings.length) {
    return (
      <div className="report-empty-state">
        <strong>No findings detected.</strong>
        <span>The deterministic Council rules did not flag defects for this run.</span>
      </div>
    );
  }

  return (
    <div className="council-finding-list">
      {findings.map((finding) => {
        const character = getCharacterById(getFindingCharacterId(finding.agentId));
        const characterState = finding.status === 'retest_passed'
          ? 'approved'
          : finding.status === 'fixed'
            ? 'completed'
            : finding.severity === 'Critical' || finding.severity === 'High'
              ? 'warning'
              : 'reviewing';

        return (
          <article key={finding.id} className="council-finding-card">
            <div className="finding-topline">
              <span className={`severity-pill ${severityClass(finding.severity)}`}>{finding.severity}</span>
              <span>{finding.impactedArea}</span>
              <span>{finding.status.replace('_', ' ')}</span>
            </div>
            {character && (
              <div className="finding-character-owner">
                <CharacterAvatar character={character} state={characterState} compact />
                <span>
                  <strong>{character.displayName}</strong>
                  {character.archetype}
                </span>
              </div>
            )}
            <h3>{finding.title}</h3>
            <p>{finding.finding}</p>
            <div className="finding-detail-grid">
              <span><strong>Repair</strong>{finding.recommendedRepair}</span>
              <span><strong>Acceptance</strong>{finding.acceptanceCriteria}</span>
              <span><strong>Owner</strong>{finding.assignedTo ?? 'unassigned'}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CouncilDecision({ run }: { run: CouncilRun }) {
  const decision = run.executiveDecision;

  if (!decision) {
    return <div className="report-empty-state"><strong>Executive decision pending.</strong></div>;
  }

  return (
    <div className="council-decision-grid">
      <article className="executive-summary-card">
        <span>CEO Decision</span>
        <p>{decision.decision} at {decision.releaseReadinessScore}% release readiness. {decision.summary}</p>
      </article>
      <ReportList title="Top Blockers" items={decision.topBlockers} />
      <ReportList title="Top Repairs" items={decision.topRepairs} />
      <ReportList title="Growth Opportunities" items={decision.topOpportunities} />
      <ReportList title="Required Next Actions" items={decision.requiredNextActions} />
      <article className="council-lens-panel">
        <h3>Executive Council Lenses</h3>
        <div className="lens-grid">
          {decision.lenses.map((lens) => (
            <span key={lens.id}>
              <strong>{lens.name}</strong>
              {lens.recommendation}
            </span>
          ))}
        </div>
      </article>
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
