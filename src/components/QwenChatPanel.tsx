import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, RefreshCw, Send, ShieldCheck, Sparkles, Square, Trash2 } from 'lucide-react';
import type { AgentProject, QwenChatMessage, QwenConfigResult } from '../types';

const SYSTEM_PROMPT =
  'You are Agent FORCE Qwen Chat, a local assistant embedded in a multi-project agent dashboard. Be concise, practical, and safety-aware. Do not invent project facts, credentials, secrets, or completion claims.';

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
  return [
    `Project: ${project.name}`,
    `Callsign: ${project.callsign}`,
    `Status: ${project.status}`,
    `Priority: ${project.priority}`,
    `Objective: ${project.objective}`,
    `Mission brief: ${project.missionBrief}`,
    `Top blockers: ${(project.currentBlockers ?? ['No blockers recorded']).join('; ')}`,
    `Next actions: ${project.nextActions.join('; ')}`
  ].join('\n');
}

export function QwenChatPanel({ project, onActivity }: QwenChatPanelProps) {
  const [config, setConfig] = useState<QwenConfigResult | null>(null);
  const [status, setStatus] = useState('Loading model configuration...');
  const [prompt, setPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const tokenCountRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);
  const promptPhaseTimerRef = useRef<number | null>(null);

  const chatMessages = useMemo<QwenChatMessage[]>(() => [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nCurrent project context:\n${buildProjectContext(project)}` },
    ...messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({ role: message.role, content: message.content }))
  ], [messages, project]);

  useEffect(() => {
    let mounted = true;
    window.agentForce?.qwenConfig?.().then((result) => {
      if (!mounted) return;
      setConfig(result);
      setStatus(result.runtime?.autostart
        ? `Managed runtime ${result.runtime.running ? 'running' : 'will start on Health or Send'}.`
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
    if (promptPhaseTimerRef.current !== null) window.clearTimeout(promptPhaseTimerRef.current);
    progressTimerRef.current = null;
    promptPhaseTimerRef.current = null;
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
    setStatus(config ? `${config.modelName} / ${config.baseUrl}` : 'Ready.');
  }

  function sendMessage() {
    const content = prompt.trim();
    if (!content || isSending) return;
    if (!window.agentForce?.qwenStreamChat) {
      setStatus('Qwen bridge unavailable. Run inside the Electron app.');
      return;
    }

    const userMessage: TranscriptMessage = { id: makeId('user'), role: 'user', content };
    const assistantId = makeId('assistant');
    const assistantMessage: TranscriptMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streamState: 'connecting',
      elapsedMs: 0,
      tokenCount: 0
    };
    const outgoingMessages: QwenChatMessage[] = [
      ...chatMessages,
      { role: 'user', content }
    ];

    setPrompt('');
    setIsSending(true);
    setStatus(STREAM_STATE_COPY.connecting);
    setMessages((current) => [...current, userMessage, assistantMessage]);
    activeAssistantIdRef.current = assistantId;
    startProgressTimer(assistantId);
    promptPhaseTimerRef.current = window.setTimeout(() => {
      setMessages((current) => current.map((message) =>
        message.id === assistantId && message.streamState === 'connecting'
          ? { ...message, streamState: 'prompt-evaluating' }
          : message
      ));
      if (activeAssistantIdRef.current === assistantId) setStatus(STREAM_STATE_COPY['prompt-evaluating']);
    }, 250);

    const requestId = makeId('qwen');
    cleanupRef.current = window.agentForce.qwenStreamChat(requestId, outgoingMessages, (event) => {
      if (event.type === 'token') {
        tokenCountRef.current += 1;
        if (promptPhaseTimerRef.current !== null) window.clearTimeout(promptPhaseTimerRef.current);
        promptPhaseTimerRef.current = null;
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
    <section className="qwen-chat-workflow qwen-chat-landing glass-panel holo-border" aria-label="Agent FORCE generative chat">
      <div className="section-heading qwen-chat-heading">
        <div className="qwen-heading-identity">
          <span className="qwen-mark"><Sparkles size={20} /></span>
          <div>
            <div className="eyebrow">AI Command Interface</div>
            <h2>Ask Agent FORCE</h2>
          </div>
        </div>
        <div className="report-actions">
          <button onClick={checkHealth} title="Check model health"><RefreshCw size={16} /> Health</button>
          <button onClick={clearChat} disabled={isSending || messages.length === 0} title="Clear conversation"><Trash2 size={16} /> Clear</button>
        </div>
      </div>

      <div className="qwen-runtime-bar" aria-live="polite">
        <span className={`qwen-runtime-dot ${status.startsWith('Ready') || config?.runtime?.running ? 'online' : ''}`} />
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
                <p>{message.content || (message.streamState ? STREAM_STATE_COPY[message.streamState] : '')}</p>
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
            disabled={isSending}
            rows={2}
          />
          <button
            className={isSending ? 'qwen-cancel-action' : 'primary-action'}
            onClick={isSending ? cancelMessage : sendMessage}
            disabled={!isSending && !prompt.trim()}
            title={isSending ? 'Cancel generation' : 'Send message'}
          >
            {isSending ? <Square size={15} fill="currentColor" /> : <Send size={16} />}
            {isSending ? 'Cancel' : 'Send'}
          </button>
        </div>
      </div>

      <div className="qwen-quick-prompts" aria-label="Suggested prompts">
        {QUICK_PROMPTS.map((item) => (
          <button key={item.label} onClick={() => setPrompt(item.prompt)} disabled={isSending}>{item.label}</button>
        ))}
      </div>
    </section>
  );
}
