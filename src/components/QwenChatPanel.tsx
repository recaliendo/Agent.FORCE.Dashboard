import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, RefreshCw, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import type { AgentProject, QwenChatMessage, QwenConfigResult } from '../types';

const SYSTEM_PROMPT =
  'You are Agent FORCE Qwen Chat, a local assistant embedded in a multi-project agent dashboard. Be concise, practical, and safety-aware. Do not invent project facts, credentials, secrets, or completion claims.';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status?: 'streaming' | 'error';
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
    }).catch(() => {
      if (mounted) setStatus('Qwen bridge unavailable. Run inside the Electron app.');
    });
    return () => {
      mounted = false;
      cleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setMessages([]);
    setPrompt('');
    setIsSending(false);
  }, [project.id]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function checkHealth() {
    setStatus(config?.runtime?.autostart ? 'Starting managed Qwen runtime...' : 'Checking Qwen endpoint...');
    const result = await window.agentForce?.qwenHealth?.();
    if (!result) {
      setStatus('Qwen bridge unavailable. Run inside the Electron app.');
      return;
    }
    setStatus(result.ok ? `Ready: ${result.modelName} / ${result.baseUrl}` : `Unavailable: ${result.error}`);
    if (result.ok) onActivity?.('Qwen health check passed', result.baseUrl);
  }

  function clearChat() {
    cleanupRef.current?.();
    cleanupRef.current = null;
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
    const assistantMessage: TranscriptMessage = { id: assistantId, role: 'assistant', content: '', status: 'streaming' };
    const outgoingMessages: QwenChatMessage[] = [
      ...chatMessages,
      { role: 'user', content }
    ];

    setPrompt('');
    setIsSending(true);
    setStatus('Streaming from Qwen...');
    setMessages((current) => [...current, userMessage, assistantMessage]);

    const requestId = makeId('qwen');
    cleanupRef.current = window.agentForce.qwenStreamChat(requestId, outgoingMessages, (event) => {
      if (event.type === 'token') {
        setMessages((current) => current.map((message) =>
          message.id === assistantId ? { ...message, content: `${message.content}${event.token}` } : message
        ));
      }

      if (event.type === 'done') {
        cleanupRef.current?.();
        cleanupRef.current = null;
        setIsSending(false);
        setStatus(config ? `Ready: ${config.modelName}` : 'Ready.');
        setMessages((current) => current.map((message) =>
          message.id === assistantId ? { ...message, status: undefined, content: message.content || 'Done.' } : message
        ));
        onActivity?.('Qwen chat response completed', project.name);
      }

      if (event.type === 'error') {
        cleanupRef.current?.();
        cleanupRef.current = null;
        setIsSending(false);
        setStatus(`Qwen error: ${event.error}`);
        setMessages((current) => current.map((message) =>
          message.id === assistantId ? { ...message, status: 'error', content: event.error } : message
        ));
        onActivity?.('Qwen chat failed', event.error);
      }
    });
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
              <article key={message.id} className={`qwen-message qwen-${message.role} ${message.status ?? ''}`}>
                <span>{message.role === 'assistant' ? <Bot size={15} /> : message.role === 'user' ? <MessageCircle size={15} /> : <ShieldCheck size={15} />} {message.role}</span>
                <p>{message.content || (message.status === 'streaming' ? '...' : '')}</p>
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
          <button className="primary-action" onClick={sendMessage} disabled={isSending || !prompt.trim()}>
            {isSending ? <RefreshCw size={16} /> : <Send size={16} />} Send
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
