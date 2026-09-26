import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, RefreshCw, Send, ShieldCheck, Sparkles, Square, Trash2 } from 'lucide-react';
import type { AgentProject, QwenChatMessage, QwenConfigResult } from '../types';
import { evaluateReadiness } from '../readinessEngine';
import { StreamingMarkdown } from './StreamingMarkdown';
import { Button, Card, StatusDot } from './ui/Primitives';

const SYSTEM_PROMPT =
  'You are Agent FORCE Qwen Chat, a local assistant embedded in a multi-project agent dashboard. Be concise, practical, and safety-aware. Do not invent project facts, credentials, secrets, or completion claims.';
const MAX_CONTEXT_TURNS = 6;

type QwenStreamState =
  | 'connecting'
  | 'prompt-evaluating'
  | 'generating'
  | 'complete'
  | 'cancelled'
  | 'auth-failed'
  | 'inactivity-timeout'
  | 'parse-error'
  | 'server-unavailable';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  turnId?: string;
  streamState?: QwenStreamState;
  elapsedMs?: number;
  tokenCount?: number;
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
  connecting: 'Opening a connection to the Qwen runtime.',
  'prompt-evaluating': 'Qwen is evaluating the project context and prompt.',
  generating: 'Response tokens are arriving.',
  complete: 'Response complete.',
  cancelled: 'Generation cancelled and the server slot was released.',
  'auth-failed': 'Authentication failed. Check the configured provider credential.',
  'inactivity-timeout': 'Generation stopped because no token arrived before the inactivity limit.',
  'parse-error': 'The provider returned a stream frame the app could not parse.',
  'server-unavailable': 'The Qwen endpoint is unavailable. Check the runtime and host/port settings.'
};

const STREAM_STATE_LABELS: Record<QwenStreamState, string> = {
  connecting: 'Connecting',
  'prompt-evaluating': 'Prompt evaluating',
  generating: 'Generating',
  complete: 'Complete',
  cancelled: 'Cancelled',
  'auth-failed': 'Auth failed',
  'inactivity-timeout': 'Inactivity timeout',
  'parse-error': 'Parse error',
  'server-unavailable': 'Server unavailable'
};

function classifyStreamError(error: string): QwenStreamState {
  if (error.startsWith('AUTH_FAILED:')) return 'auth-failed';
  if (error.startsWith('INACTIVITY_TIMEOUT:')) return 'inactivity-timeout';
  if (error.startsWith('PARSE_ERROR:')) return 'parse-error';
  if (error.startsWith('CANCELLED:')) return 'cancelled';
  return 'server-unavailable';
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
      subject: record.subject,
      date: record.sentAtDisplay ?? record.sentAt ?? record.date,
      from: record.from,
      description: record.description,
      amount: record.amount,
      type: record.type,
      status: record.status,
      body: typeof record.body === 'string' && record.body ? record.body : '[body not cached]'
    };
}

function buildOfwContext(evidence: Record<string, unknown>) {
  const freshness = evidence.freshness && typeof evidence.freshness === 'object' ? evidence.freshness as Record<string, unknown> : {};
  return [
    'OFW evidence context (read-only; retrieved for this prompt):',
    `Scan complete: ${String(evidence.complete ?? 'unknown')}`,
    `Freshness: ${String(freshness.staleness ?? 'unknown')} as of ${String(freshness.asOf ?? 'unknown')}`,
    `Messages scanned: ${Array.isArray(evidence.messages) ? evidence.messages.length : 0}`,
    `Expenses scanned: ${Array.isArray(evidence.expenses) ? evidence.expenses.length : 0}`,
    `Calendar events scanned: ${Array.isArray(evidence.calendar) ? evidence.calendar.length : 0}`,
    `Expense totals: ${JSON.stringify(evidence.totals ?? {})}`,
    `Messages: ${JSON.stringify((evidence.messages as unknown[] ?? []).map(summarizeRecord))}`,
    `Expenses: ${JSON.stringify((evidence.expenses as unknown[] ?? []).map(summarizeRecord))}`,
    `Calendar: ${JSON.stringify((evidence.calendar as unknown[] ?? []).map(summarizeRecord))}`
  ].join('\n');
}

async function scanOfwEvidence() {
  const bridge = window.agentForce;
  const ofw = bridge?.ofw;
  if (typeof ofw !== 'function') throw new Error('OFW bridge unavailable');
  const callOfw = (action: string, input: Record<string, unknown>) => ofw(action, input);
  const until = new Date();
  const untilDate = formatLocalDate(until);
  const baseRange = { since: '2000-01-01', until: untilDate };
  const sync = await callOfw('sync', {});
  if (!sync.ok) throw new Error(sync.error ?? 'OFW sync failed');

  async function collect(action: 'messages' | 'expenses', key: string) {
    const rows: unknown[] = [];
    let cursor = action === 'messages' ? 1 : 0;
    let complete = false;
    for (let iteration = 0; iteration < 40; iteration += 1) {
      const input = action === 'messages'
        ? { ...baseRange, folderId: 'both', page: cursor, size: 25, q: '' }
        : { start: cursor, max: 25 };
      const response = await callOfw(action, input);
      if (!response.ok) throw new Error(response.error ?? `OFW ${action} failed`);
      const data = response.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : {};
      rows.push(...recordRows(data, key));
      complete = data.complete === true || data.hasMore === false || data.nextPage == null && data.nextStart == null;
      if (complete) return { rows, complete: true, freshness: data.freshness };
      cursor = action === 'messages'
        ? Number(data.nextPage ?? cursor + 1)
        : Number(data.nextStart ?? cursor + 25);
    }
    return { rows, complete: false };
  }

  const [messages, expenses, totals, calendar] = await Promise.all([
    collect('messages', 'messages'),
    collect('expenses', 'expenses'),
    callOfw('totals', {}),
    callOfw('calendar', { startDate: '2000-01-01', endDate: untilDate })
  ]);
  if (!totals.ok) throw new Error(totals.error ?? 'OFW expense totals failed');
  if (!calendar.ok) throw new Error(calendar.error ?? 'OFW calendar scan failed');
  const calendarData = calendar.data && typeof calendar.data === 'object' ? calendar.data as Record<string, unknown> : {};
  return {
    complete: messages.complete && expenses.complete,
    freshness: messages.freshness ?? expenses.freshness,
    messages: messages.rows,
    expenses: expenses.rows,
    totals: totals.data,
    calendar: recordRows(calendarData, 'events')
  };
}

function buildQwenMessages(project: AgentProject, messages: TranscriptMessage[], ofwContext: string | null) {
  const completedTurnIds = messages
    .filter((message) => message.role === 'assistant' && message.streamState === 'complete' && message.turnId)
    .map((message) => message.turnId as string)
    .slice(-MAX_CONTEXT_TURNS);
  const retainedTurns = new Set(completedTurnIds);
  const evidenceInstruction = ofwContext
    ? `\n\n${ofwContext}\nUse this as source evidence. Separate observed facts from inferences, identify missing or stale data, and never claim the OFW record is complete unless Result complete is true.`
    : '';
  return [
    { role: 'system' as const, content: `${SYSTEM_PROMPT}\n\nCurrent project context:\n${buildProjectContext(project)}${evidenceInstruction}` },
    ...messages
      .filter((message) =>
        (message.role === 'user' || message.role === 'assistant') &&
        Boolean(message.turnId && retainedTurns.has(message.turnId))
      )
      .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content }))
  ];
}

export function QwenChatPanel({ project, onActivity }: QwenChatPanelProps) {
  const [config, setConfig] = useState<QwenConfigResult | null>(null);
  const [status, setStatus] = useState('Loading model configuration...');
  const [prompt, setPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [ofwContext, setOfwContext] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const tokenCountRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);

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

  function finishStream(assistantId: string, streamState: QwenStreamState, content?: string) {
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
            streamState,
            elapsedMs,
            tokenCount: tokenCountRef.current,
            content: content ?? message.content
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

    let contextForTurn = ofwContext;
    if (project.id === 'legal-ops-console') {
      setStatus('Reading read-only OFW context...');
      try {
        const evidence = await scanOfwEvidence();
        contextForTurn = buildOfwContext(evidence);
        setOfwContext(contextForTurn);
      } catch (error) {
        contextForTurn = `OFW evidence context was unavailable for this prompt: ${error instanceof Error ? error.message : 'connector error'}`;
      }
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
    const outgoingMessages: QwenChatMessage[] = [
      ...buildQwenMessages(project, messages, contextForTurn),
      { role: 'user', content }
    ];

    setPrompt('');
    setIsSending(true);
    setStatus(STREAM_STATE_COPY.connecting);
    setMessages((current) => [...current, userMessage, assistantMessage]);
    activeAssistantIdRef.current = assistantId;
    startProgressTimer(assistantId);

    cleanupRef.current = window.agentForce.qwenStreamChat(requestId, outgoingMessages, (event) => {
      if (event.type === 'phase' && event.phase === 'prompt-evaluating') {
        setMessages((current) => current.map((message) =>
          message.id === assistantId && message.streamState === 'connecting'
            ? { ...message, streamState: 'prompt-evaluating' }
            : message
        ));
        if (activeAssistantIdRef.current === assistantId) setStatus(STREAM_STATE_COPY['prompt-evaluating']);
      }

      if (event.type === 'token') {
        tokenCountRef.current += 1;
        setStatus(STREAM_STATE_COPY.generating);
        setMessages((current) => current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: `${message.content}${event.token}`,
                streamState: 'generating',
                tokenCount: tokenCountRef.current
              }
            : message
        ));
      }

      if (event.type === 'done') {
        finishStream(assistantId, 'complete');
        setStatus(config ? `Ready: ${config.modelName}` : 'Ready.');
        onActivity?.('Qwen chat response completed', project.name);
      }

      if (event.type === 'error') {
        const streamState = classifyStreamError(event.error);
        const copy = STREAM_STATE_COPY[streamState];
        finishStream(assistantId, streamState, event.error);
        setStatus(`${STREAM_STATE_LABELS[streamState]}: ${copy}`);
        onActivity?.('Qwen chat failed', event.error);
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
          <Button icon={<RefreshCw size={16} />} onClick={checkHealth} title="Check model health">Health</Button>
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
                {message.content && message.streamState && (
                  <p className="qwen-state-copy">{STREAM_STATE_COPY[message.streamState]}</p>
                )}
                {message.streamState && (
                  <div className="qwen-stream-meta" aria-label="Generation progress">
                    <strong>{STREAM_STATE_LABELS[message.streamState]}</strong>
                    <span>{((message.elapsedMs ?? 0) / 1000).toFixed(1)}s</span>
                    <span>{message.tokenCount ?? 0} tokens</span>
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
