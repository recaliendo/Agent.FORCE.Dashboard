import { useEffect, useRef, useState } from 'react';
import { Bot, ClipboardCopy, MessageCircle, RefreshCw, Send, ShieldCheck, Sparkles, Square, Stethoscope, Trash2, X } from 'lucide-react';
import type { AgentProject, QwenChatMessage, QwenConfigResult, QwenDoctorReport, QwenStats } from '../types';
import { describeBuild } from '../appBuild';
import { evaluateReadiness } from '../readinessEngine';
import { StreamingMarkdown } from './StreamingMarkdown';
import { Badge, Button, Card, StatusDot } from './ui/Primitives';

const SYSTEM_PROMPT =
  'You are Agent FORCE Qwen Chat, a local assistant embedded in a multi-project agent dashboard. Be concise, practical, and safety-aware. Do not invent project facts, credentials, secrets, or completion claims.';
const MAX_CONTEXT_TURNS = 6;

type QwenStreamState =
  | 'connecting'
  | 'queued'
  | 'prompt-evaluating'
  | 'generating'
  | 'complete'
  | 'cancelled'
  | 'auth-failed'
  | 'inactivity-timeout'
  | 'parse-error'
  | 'context-overflow'
  | 'model-loading'
  | 'queue-timeout'
  | 'runtime-failed'
  | 'http-error'
  | 'server-unavailable'
  | 'remote-blocked';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  turnId?: string;
  streamState?: QwenStreamState;
  elapsedMs?: number;
  tokenCount?: number;
  /** Prompt-reading progress reported by llama.cpp. */
  progress?: { processed: number; total: number; cached: number };
  stats?: QwenStats;
  truncatedAt?: number;
  notice?: string;
  /** Technical detail of a failure, shown under the plain-language state copy. */
  errorDetail?: string;
}

interface QwenChatPanelProps {
  project: AgentProject;
  onActivity?: (message: string, detail?: string) => void;
}

const QUICK_PROMPTS = [
  {
    label: 'Prioritize next move',
    prompt: 'Assess this project and recommend the single highest-value next move. Explain the reason and give me the first three concrete actions.'
  },
  {
    label: 'Review project risk',
    prompt: 'Review the current project context for operational risks, missing evidence, and blockers. Rank the findings by urgency.'
  },
  {
    label: 'Build an action plan',
    prompt: 'Create a concise action plan for this project using the recorded objective, blockers, and next actions.'
  }
];

const STREAM_STATE_COPY: Record<QwenStreamState, string> = {
  connecting: 'Starting the request.',
  queued: 'Waiting for Qwen: it is finishing another request or still loading the model.',
  'prompt-evaluating': 'Qwen is reading the question and project context.',
  generating: 'Writing the answer.',
  complete: 'Response complete.',
  cancelled: 'Cancelled. The model stops after its current step.',
  'auth-failed': 'The model server rejected the API key. Run Health for the fix.',
  'inactivity-timeout': 'The model server went silent mid-answer. Run Health for details.',
  'parse-error': 'The model server sent a response the app could not read.',
  'context-overflow': 'This request was too large for the model’s context window.',
  'model-loading': 'The model is still loading into memory. Try again in a few seconds.',
  'queue-timeout': 'Qwen stayed busy with another request for too long. Try again.',
  'runtime-failed': 'The local Qwen runtime could not start. Run Health for the reason.',
  'http-error': 'The model server returned an error.',
  'server-unavailable': 'The local Qwen server is not answering. Run Health for details.',
  'remote-blocked': 'OFW records are only sent to a model on this computer, so this request was refused.'
};

const STREAM_STATE_LABELS: Record<QwenStreamState, string> = {
  connecting: 'Starting',
  queued: 'Waiting',
  'prompt-evaluating': 'Reading',
  generating: 'Writing',
  complete: 'Complete',
  cancelled: 'Cancelled',
  'auth-failed': 'Key rejected',
  'inactivity-timeout': 'Server silent',
  'parse-error': 'Unreadable response',
  'context-overflow': 'Too large',
  'model-loading': 'Model loading',
  'queue-timeout': 'Busy',
  'runtime-failed': 'Runtime failed',
  'http-error': 'Server error',
  'server-unavailable': 'Server unavailable',
  'remote-blocked': 'Blocked for privacy'
};

const ERROR_STATES = new Set<QwenStreamState>(['auth-failed', 'inactivity-timeout', 'parse-error', 'context-overflow', 'model-loading', 'queue-timeout', 'runtime-failed', 'http-error', 'server-unavailable', 'remote-blocked']);

const CODE_TO_STATE: Record<string, QwenStreamState> = {
  AUTH_FAILED: 'auth-failed',
  INACTIVITY_TIMEOUT: 'inactivity-timeout',
  PARSE_ERROR: 'parse-error',
  CANCELLED: 'cancelled',
  CONTEXT_OVERFLOW: 'context-overflow',
  MODEL_LOADING: 'model-loading',
  QUEUE_TIMEOUT: 'queue-timeout',
  RUNTIME_FAILED: 'runtime-failed',
  HTTP_ERROR: 'http-error',
  SERVER_UNAVAILABLE: 'server-unavailable',
  REMOTE_MODEL_BLOCKED: 'remote-blocked'
};

/** The main process sends a code; older builds sent only a "CODE: detail" string. */
function classifyStreamError(error: string, code?: string): QwenStreamState {
  if (code && CODE_TO_STATE[code]) return CODE_TO_STATE[code];
  const prefix = /^([A-Z_]+):/.exec(error)?.[1];
  return (prefix && CODE_TO_STATE[prefix]) || 'server-unavailable';
}

function statsLine(stats: QwenStats): string {
  const parts: string[] = [];
  if (stats.promptTokens !== undefined) {
    const read = stats.promptTokens + (stats.cachedTokens ?? 0);
    parts.push(`read ${read.toLocaleString()} tokens${stats.cachedTokens ? ` (${stats.cachedTokens.toLocaleString()} from cache)` : ''}${stats.promptMs !== undefined ? ` in ${(stats.promptMs / 1000).toFixed(1)}s` : ''}`);
  }
  if (stats.generatedTokens !== undefined) {
    parts.push(`wrote ${stats.generatedTokens.toLocaleString()} tokens${stats.generationTokensPerSecond ? ` at ${Math.round(stats.generationTokensPerSecond)}/s` : ''}`);
  }
  return parts.join(' · ');
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildProjectContext(project: AgentProject) {
  const readiness = evaluateReadiness({ project, savedReports: [], activity: [], nowMs: 0 });
  return [
    `Project: ${project.name}`,
    `Callsign: ${project.callsign}`,
    `Status: ${project.status}`,
    `Priority: ${project.priority}`,
    `Objective: ${project.objective}`,
    `Mission brief: ${project.missionBrief}`,
    `Top blockers: ${(project.currentBlockers?.length ? project.currentBlockers : [readiness.topRisk]).join('; ')}`,
    `Next actions: ${readiness.actions.map((action) => action.label).join('; ')}`,
    `Evidence keys: ${readiness.actions.flatMap((action) => action.evidenceKeys).join('; ')}`
  ].join('\n');
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function recordRows(data: unknown, key: string) {
  const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  return Array.isArray(payload[key]) ? payload[key] : [];
}

function summarizeRecord(item: unknown) {
  const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  return {
    id: record.id,
    date: record.date ?? record.startDate ?? record.sentAtDisplay ?? record.sentAt,
    title: record.title ?? record.subject,
    description: record.description,
    amount: record.amount,
    type: record.type,
    status: record.status
  };
}

const MONEY_WORDS = /\b(expenses?|reimburs\w*|paid|pay(ing|ment|s)?|costs?|owe[sd]?|money|bills?|receipts?|split|support)\b|\$/i;
const CALENDAR_WORDS = /\b(calendar|schedul\w*|events?|visits?|weekends?|holidays?|pick-?ups?|drop-?offs?|exchanges?|custody|parenting time|appointments?)\b/i;
const MAX_EXTRA_ROWS = 15;

/**
 * OFW evidence for one chat turn. Messages come from natural-language
 * retrieval (the few relevant excerpts, cited by number) instead of the whole
 * record; expenses and calendar are added only when the question is about
 * them, and capped. The main process refuses unless the model is local.
 */
async function retrieveOfwContext(question: string): Promise<string> {
  const bridge = window.agentForce;
  if (!bridge?.ofwChatContext || !bridge.ofw) throw new Error('OFW bridge unavailable');
  const retrieved = await bridge.ofwChatContext(question);
  if (!retrieved.ok || !retrieved.data) throw new Error(retrieved.error ?? 'OFW search failed');
  const parts = [retrieved.data.context];

  if (MONEY_WORDS.test(question)) {
    const [totals, expenses] = await Promise.all([bridge.ofw('totals', {}), bridge.ofw('expenses', { start: 0 })]);
    if (totals.ok) parts.push(`OFW expense totals: ${JSON.stringify(totals.data ?? {})}`);
    if (expenses.ok) parts.push(`Most recent OFW expenses (up to ${MAX_EXTRA_ROWS}): ${JSON.stringify(recordRows(expenses.data, 'expenses').slice(0, MAX_EXTRA_ROWS).map(summarizeRecord))}`);
  }
  if (CALENDAR_WORDS.test(question)) {
    const start = new Date(); start.setDate(start.getDate() - 60);
    const end = new Date(); end.setDate(end.getDate() + 60);
    const calendar = await bridge.ofw('calendar', { startDate: formatLocalDate(start), endDate: formatLocalDate(end) });
    if (calendar.ok) parts.push(`OFW calendar events, 60 days either side of today (up to ${MAX_EXTRA_ROWS}): ${JSON.stringify(recordRows(calendar.data, 'events').slice(0, MAX_EXTRA_ROWS).map(summarizeRecord))}`);
  }
  return parts.join('\n\n');
}

/**
 * The system prompt stays byte-identical between turns (project context is
 * deterministic), so llama.cpp can reuse it and the earlier conversation from
 * its prompt cache. Per-question OFW excerpts go on the NEW user message only;
 * putting them in the system prompt changed its text every turn and forced
 * the whole conversation to be re-read each time.
 */
type OfwTurnContext = { ok: true; context: string } | { ok: false; reason: string } | null;

function buildQwenMessages(project: AgentProject, messages: TranscriptMessage[], ofw: OfwTurnContext, question: string): QwenChatMessage[] {
  const completedTurnIds = messages
    .filter((message) => message.role === 'assistant' && message.streamState === 'complete' && message.turnId)
    .map((message) => message.turnId as string)
    .slice(-MAX_CONTEXT_TURNS);
  const retainedTurns = new Set(completedTurnIds);
  const finalUser = ofw?.ok
    ? `${ofw.context}\n\nUse these excerpts as source evidence. Cite message numbers exactly like [#123] for every claim about the records, separate observed facts from inferences, and never claim the OFW record is complete when coverage limits are listed.\n\nQuestion: ${question}`
    : ofw
      // No excerpts reached the model, so it must not answer from the records at all.
      ? `The OFW records could not be retrieved for this question (${ofw.reason}). Do not state or cite anything about the records; say they were unavailable and answer only what does not depend on them.\n\nQuestion: ${question}`
      : question;
  return [
    { role: 'system' as const, content: `${SYSTEM_PROMPT}\n\nCurrent project context:\n${buildProjectContext(project)}` },
    ...messages
      .filter((message) =>
        (message.role === 'user' || message.role === 'assistant') &&
        Boolean(message.turnId && retainedTurns.has(message.turnId))
      )
      .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content })),
    { role: 'user' as const, content: finalUser }
  ];
}

export function QwenChatPanel({ project, onActivity }: QwenChatPanelProps) {
  const [config, setConfig] = useState<QwenConfigResult | null>(null);
  const [status, setStatus] = useState('Loading model configuration...');
  const [prompt, setPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [ofwContext, setOfwContext] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<QwenDoctorReport | null>(null);
  const [doctorRunning, setDoctorRunning] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const tokenCountRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);
  // The project on screen now; an OFW lookup that finishes after a switch is dropped.
  const projectIdRef = useRef(project.id);
  projectIdRef.current = project.id;

  useEffect(() => {
    let mounted = true;
    if (!window.agentForce?.qwenConfig) {
      setStatus('Qwen is available in the Electron desktop app.');
      return () => { mounted = false; };
    }
    window.agentForce?.qwenConfig?.().then((result) => {
      if (!mounted) return;
      setConfig(result);
      setStatus(result.runtime?.autostart
        ? `Managed runtime ${result.runtime.running ? 'running' : 'is starting in the background'}.`
        : `${result.modelName} / ${result.baseUrl}`);
    }).catch((error) => {
      if (!mounted) return;
      const detail = error instanceof Error ? error.message : 'Unknown bridge error.';
      setStatus(`Qwen bridge unavailable: ${detail}`);
    });
    return () => {
      mounted = false;
      cleanupRef.current?.();
      stopProgressTimers();
    };
  }, []);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    stopProgressTimers();
    activeAssistantIdRef.current = null;
    setMessages([]);
    setOfwContext(null);
    setPrompt('');
    setIsSending(false);
  }, [project.id]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function runDoctor() {
    if (!window.agentForce?.qwenDoctor) {
      await checkHealth();
      return;
    }
    setDoctorRunning(true);
    setStatus('Checking Qwen — this measures real speed and can take up to a minute…');
    try {
      const report = await window.agentForce.qwenDoctor(describeBuild());
      setDoctor(report);
      setStatus(report.verdict === 'pass' ? `Ready: ${report.summary}` : report.summary);
      if (report.verdict === 'pass') onActivity?.('Qwen health check passed', report.summary);
    } catch (error) {
      setStatus(`Health check failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setDoctorRunning(false);
    }
  }

  async function copyDoctorReport() {
    if (!doctor) return;
    try {
      await navigator.clipboard.writeText(doctor.text);
      setStatus('Health report copied. It contains no passwords or keys.');
    } catch {
      setStatus('Copy blocked. Select the report text manually.');
    }
  }

  async function checkHealth() {
    setStatus(config?.runtime?.autostart ? 'Starting managed Qwen runtime...' : 'Checking Qwen endpoint...');
    try {
      const result = await window.agentForce?.qwenHealth?.();
      if (!result) {
        setStatus('Qwen bridge unavailable. Run inside the Electron app.');
        return;
      }
      setStatus(result.ok ? `Ready: ${result.modelName} / ${result.baseUrl}` : `Unavailable: ${result.error}`);
      if (result.ok) onActivity?.('Qwen health check passed', result.baseUrl);
    } catch (error) {
      setStatus(`Unavailable: ${error instanceof Error ? error.message : 'Health check failed.'}`);
    }
  }

  function stopProgressTimers() {
    if (progressTimerRef.current !== null) window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
  }

  function startProgressTimer(assistantId: string) {
    startedAtRef.current = Date.now();
    tokenCountRef.current = 0;
    progressTimerRef.current = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAtRef.current;
      setMessages((current) => current.map((message) =>
        message.id === assistantId ? { ...message, elapsedMs } : message
      ));
    }, 250);
  }

  function finishStream(assistantId: string, streamState: QwenStreamState, extra: Partial<TranscriptMessage> = {}) {
    stopProgressTimers();
    const elapsedMs = Date.now() - startedAtRef.current;
    cleanupRef.current?.();
    cleanupRef.current = null;
    activeAssistantIdRef.current = null;
    setIsSending(false);
    setMessages((current) => current.map((message) =>
      message.id === assistantId
        ? {
            ...message,
            ...extra,
            streamState,
            elapsedMs,
            tokenCount: tokenCountRef.current
          }
        : message
    ));
  }

  function clearChat() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    stopProgressTimers();
    activeAssistantIdRef.current = null;
    setIsSending(false);
    setPrompt('');
    setMessages([]);
    setOfwContext(null);
    setStatus(config ? `${config.modelName} / ${config.baseUrl}` : 'Ready.');
  }

  async function sendMessage() {
    const content = prompt.trim();
    if (!content || isSending) return;
    if (!window.agentForce?.qwenStreamChat) {
      setStatus('Qwen bridge unavailable. Run inside the Electron app.');
      return;
    }

    let contextForTurn: OfwTurnContext = null;
    if (project.recordsWorkspace === 'ofw') {
      // Busy from here: retrieval takes seconds, and a second Send must not start a second turn.
      setIsSending(true);
      setStatus('Finding the relevant OFW messages...');
      const projectAtSend = project.id;
      try {
        const context = await retrieveOfwContext(content);
        contextForTurn = { ok: true, context };
        setOfwContext(context);
      } catch (error) {
        contextForTurn = { ok: false, reason: error instanceof Error ? error.message : 'connector error' };
      }
      if (projectIdRef.current !== projectAtSend) return;
    }

    const requestId = makeId('qwen');
    const userMessage: TranscriptMessage = { id: makeId('user'), turnId: requestId, role: 'user', content };
    const assistantId = makeId('assistant');
    const assistantMessage: TranscriptMessage = {
      id: assistantId,
      turnId: requestId,
      role: 'assistant',
      content: '',
      streamState: 'connecting',
      elapsedMs: 0,
      tokenCount: 0
    };
    const outgoingMessages: QwenChatMessage[] = buildQwenMessages(project, messages, contextForTurn, content);

    setPrompt('');
    setIsSending(true);
    setStatus(STREAM_STATE_COPY.connecting);
    setMessages((current) => [...current, userMessage, assistantMessage]);
    activeAssistantIdRef.current = assistantId;
    startProgressTimer(assistantId);

    const patch = (change: (message: TranscriptMessage) => Partial<TranscriptMessage>) =>
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, ...change(message) } : message));

    cleanupRef.current = window.agentForce.qwenStreamChat(requestId, outgoingMessages, (event) => {
      switch (event.type) {
        case 'phase': {
          const next: QwenStreamState = event.phase === 'queued' ? 'queued' : 'prompt-evaluating';
          patch((message) => (message.streamState === 'connecting' || message.streamState === 'queued' ? { streamState: next } : {}));
          if (activeAssistantIdRef.current === assistantId) setStatus(STREAM_STATE_COPY[next]);
          break;
        }
        case 'progress':
          patch((message) => ({
            progress: { processed: event.processed, total: event.total, cached: event.cached },
            ...(message.streamState === 'generating' ? {} : { streamState: 'prompt-evaluating' as QwenStreamState })
          }));
          break;
        case 'token':
          tokenCountRef.current += 1;
          setStatus(STREAM_STATE_COPY.generating);
          patch((message) => ({ content: `${message.content}${event.token}`, streamState: 'generating', tokenCount: tokenCountRef.current }));
          break;
        case 'stats':
          patch(() => ({ stats: event.stats }));
          break;
        case 'truncated':
          patch(() => ({ truncatedAt: event.maxTokens }));
          break;
        case 'notice':
          patch(() => ({ notice: event.message }));
          break;
        case 'done':
          finishStream(assistantId, 'complete');
          setStatus(config ? `Ready: ${config.modelName}` : 'Ready.');
          onActivity?.('Qwen chat response completed', project.name);
          break;
        case 'error': {
          const streamState = classifyStreamError(event.error, event.code);
          finishStream(assistantId, streamState, streamState === 'cancelled' ? {} : { errorDetail: event.error.replace(/^[A-Z_]+:\s*/, '') });
          setStatus(`${STREAM_STATE_LABELS[streamState]}: ${STREAM_STATE_COPY[streamState]}`);
          onActivity?.('Qwen chat failed', event.error);
          break;
        }
      }
    });
  }

  function cancelMessage() {
    const assistantId = activeAssistantIdRef.current;
    if (!assistantId) return;
    finishStream(assistantId, 'cancelled');
    setStatus(STREAM_STATE_COPY.cancelled);
    onActivity?.('Qwen chat cancelled', project.name);
  }

  return (
    <Card className="qwen-chat-workflow qwen-chat-landing" aria-label="Agent FORCE generative chat">
      <div className="section-heading qwen-chat-heading">
        <div className="qwen-heading-identity">
          <span className="qwen-mark"><Sparkles size={20} /></span>
          <div>
            <div className="eyebrow">AI Command Interface</div>
            <h2>Ask Agent FORCE</h2>
          </div>
        </div>
        <div className="report-actions">
          <Button icon={doctorRunning ? <RefreshCw size={16} className="spin" /> : <Stethoscope size={16} />} onClick={runDoctor} disabled={doctorRunning || isSending} title="Diagnose the local model: reachability, key, context size and real speed">
            {doctorRunning ? 'Checking…' : 'Health'}
          </Button>
          <Button icon={<Trash2 size={16} />} onClick={clearChat} disabled={isSending || messages.length === 0} title="Clear conversation">Clear</Button>
        </div>
      </div>

      <div className="qwen-runtime-bar" aria-live="polite">
        <StatusDot
          tone={status.startsWith('Ready') || config?.runtime?.running ? 'success' : status.startsWith('Unavailable') ? 'danger' : 'warning'}
          label={status.startsWith('Ready') || config?.runtime?.running ? 'Online' : 'Runtime status'}
        />
        <strong>{config?.modelName?.replace('Qwen/', '') ?? 'Qwen3.6-35B-A3B'}</strong>
        <span>{status}</span>
      </div>

      {doctor && (
        <section className="qwen-doctor" aria-label="Qwen health report">
          <div className="qwen-doctor-head">
            <Badge tone={doctor.verdict === 'pass' ? 'success' : doctor.verdict === 'fail' ? 'danger' : 'warning'}>
              {doctor.verdict === 'pass' ? 'Healthy' : doctor.verdict === 'fail' ? 'Not working' : 'Needs attention'}
            </Badge>
            <span>{doctor.summary}</span>
            <Button variant="ghost" icon={<ClipboardCopy size={15} />} onClick={copyDoctorReport}>Copy report</Button>
            <Button variant="ghost" icon={<X size={15} />} onClick={() => setDoctor(null)} aria-label="Close health report" />
          </div>
          <ul className="qwen-doctor-checks">
            {doctor.checks.map((check) => (
              <li key={check.id}>
                <Badge tone={check.status === 'pass' ? 'success' : check.status === 'fail' ? 'danger' : check.status === 'warn' ? 'warning' : 'neutral'}>
                  {check.status === 'pass' ? 'OK' : check.status === 'fail' ? 'Problem' : check.status === 'warn' ? 'Check' : 'Skipped'}
                </Badge>
                <div>
                  <strong>{check.label}</strong>
                  <span>{check.detail}</span>
                  {check.remedy && <em>{check.remedy}</em>}
                </div>
              </li>
            ))}
          </ul>
          {doctor.logTail.length > 0 && (
            <details>
              <summary>Runtime log — last {doctor.logTail.length} lines (secrets removed)</summary>
              <pre>{doctor.logTail.join('\n')}</pre>
            </details>
          )}
        </section>
      )}

      <div className="qwen-chat-shell">
        {messages.length > 0 && (
          <div className="qwen-transcript" ref={transcriptRef} aria-live="polite">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`qwen-message qwen-${message.role} ${message.streamState ? `state-${message.streamState}` : ''}`}
              >
                <span>{message.role === 'assistant' ? <Bot size={15} /> : message.role === 'user' ? <MessageCircle size={15} /> : <ShieldCheck size={15} />} {message.role}</span>
                {message.content ? (
                  <StreamingMarkdown content={message.content} complete={message.streamState === 'complete'} />
                ) : (
                  <p>{message.streamState ? STREAM_STATE_COPY[message.streamState] : ''}</p>
                )}
                {message.content && message.streamState && message.streamState !== 'complete' && (
                  <p className="qwen-state-copy">{STREAM_STATE_COPY[message.streamState]}</p>
                )}
                {message.progress && message.progress.total > 0 && (message.streamState === 'prompt-evaluating' || message.streamState === 'queued') && (
                  <div className="qwen-progress">
                    <div
                      className="bar-track"
                      role="progressbar"
                      aria-label="Reading the prompt"
                      aria-valuemin={0}
                      aria-valuemax={message.progress.total}
                      aria-valuenow={message.progress.processed}
                    >
                      <span style={{ width: `${Math.min(100, Math.round((message.progress.processed / message.progress.total) * 100))}%` }} />
                    </div>
                    <small>
                      Reading {message.progress.processed.toLocaleString()} of {message.progress.total.toLocaleString()} tokens
                      {message.progress.cached ? ` · ${message.progress.cached.toLocaleString()} reused from cache` : ''}
                    </small>
                  </div>
                )}
                {message.notice && <p className="qwen-note">{message.notice}</p>}
                {message.truncatedAt && (
                  <p className="qwen-note">The answer stopped at the {message.truncatedAt}-token limit. Ask “continue” for the rest.</p>
                )}
                {message.errorDetail && message.streamState && ERROR_STATES.has(message.streamState) && (
                  <p className="qwen-error-detail">{message.errorDetail}</p>
                )}
                {message.streamState && (
                  <div className="qwen-stream-meta" aria-label="Generation progress">
                    <strong>{STREAM_STATE_LABELS[message.streamState]}</strong>
                    <span>{((message.elapsedMs ?? 0) / 1000).toFixed(1)}s</span>
                    <span>{message.stats ? statsLine(message.stats) : `${message.tokenCount ?? 0} tokens`}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="qwen-composer">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder={`Ask Agent FORCE about ${project.name}...`}
            aria-label={`Message Agent FORCE about ${project.name}`}
            disabled={isSending}
            rows={2}
          />
          <Button
            variant={isSending ? 'danger' : 'primary'}
            className={isSending ? 'qwen-cancel-action' : 'primary-action'}
            onClick={isSending ? cancelMessage : sendMessage}
            disabled={!isSending && !prompt.trim()}
            title={isSending ? 'Cancel generation' : 'Send message'}
            icon={isSending ? <Square size={15} fill="currentColor" /> : <Send size={16} />}
          >
            {isSending ? 'Cancel' : 'Send'}
          </Button>
        </div>
      </div>

      <div className="qwen-quick-prompts" aria-label="Suggested prompts">
        {QUICK_PROMPTS.map((item) => (
          <Button key={item.label} variant="ghost" onClick={() => setPrompt(item.prompt)} disabled={isSending}>{item.label}</Button>
        ))}
      </div>
    </Card>
  );
}
