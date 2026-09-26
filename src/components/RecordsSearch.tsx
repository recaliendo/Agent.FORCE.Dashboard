import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Copy, Download, FileSearch, Loader2, Quote, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import type {
  OfwFolder, OfwInterpretation, OfwSearchHit, OfwSearchMode, OfwSearchRequest, OfwSearchResponse, OfwStatus
} from '../../electron/ofw/contract';

const MODES: Array<{ id: OfwSearchMode; label: string; hint: string }> = [
  { id: 'natural', label: 'Ask a question', hint: 'Plain language: dates, who wrote it, related wording and typos are understood.' },
  { id: 'all', label: 'All words', hint: 'Every topic word (or a related form) must appear.' },
  { id: 'exact', label: 'Exact words', hint: 'The whole text as one literal phrase — nothing is interpreted.' }
];

const FOLDERS: Array<{ id: '' | OfwFolder; label: string }> = [
  { id: '', label: 'Auto (from the question)' },
  { id: 'both', label: 'Inbox + Sent' },
  { id: 'inbox', label: 'Received (inbox)' },
  { id: 'sent', label: 'Sent by me' }
];

const EXAMPLES = [
  'what did she say about the dentist last month?',
  'pickup times I sent since March',
  'reimbursement for soccer in 2025 -uniform',
  '"summer schedule"'
];

export function RecordsSearch() {
  const bridge = typeof window !== 'undefined' ? window.agentForce : undefined;
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<OfwSearchMode>('natural');
  const [folder, setFolder] = useState<'' | OfwFolder>('');
  const [status, setStatus] = useState<OfwStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<OfwSearchResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<OfwSearchRequest | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let live = true;
    bridge.ofwStatus().then((s) => { if (live) setStatus(s); }).catch(() => undefined);
    return () => { live = false; };
  }, [bridge]);

  async function run(request: OfwSearchRequest) {
    if (!bridge) return;
    setBusy(true);
    setLastRequest(request);
    try {
      setResponse(await bridge.ofwSearch(request));
      if (!status?.running) bridge.ofwStatus().then(setStatus).catch(() => undefined);
    } catch (error) {
      setResponse({ ok: false, error: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || busy) return;
    void run({ query: query.trim(), mode, ...(folder ? { folderId: folder } : {}), limit: 25 });
  }

  function exportResponse() {
    if (!response || !lastRequest) return;
    const blob = new Blob([JSON.stringify({ request: lastRequest, response }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ofw-search-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCitation(hit: OfwSearchHit) {
    const s = hit.source;
    const text = `OurFamilyWizard message #${s.messageId}, "${s.subject}", from ${s.from ?? 'unknown sender'} to ${s.to.join(', ') || 'unknown recipient'}, sent ${s.sentAtDisplay ?? s.sentAt}: ${plainSnippet(hit.snippet)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(hit.source.messageId);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable — nothing to do */
    }
  }

  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <section className="records-search glass-panel holo-border" aria-labelledby="records-search-title">
      <div className="records-head">
        <div>
          <div className="eyebrow"><FileSearch size={15} /> OurFamilyWizard records</div>
          <h2 id="records-search-title">Search your records.</h2>
          <p>Keep the source in view.</p>
        </div>
        <ConnectorBadge status={status} hasBridge={Boolean(bridge)} />
      </div>

      {!bridge ? (
        <p className="records-notice">
          Records search runs through the OFW connector in the desktop app. Start it with <code>npm run electron:dev</code>.
        </p>
      ) : (
        <form className="records-form" onSubmit={onSubmit}>
          <div className="mode-switch" role="radiogroup" aria-label="Search mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                className={mode === m.id ? 'active' : ''}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="search-console records-input">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={mode === 'exact' ? 'Exact words or phrase…' : 'Ask in plain language — "what did she say about the dentist last month?"'}
              aria-label="Search your OurFamilyWizard records"
              maxLength={2000}
            />
            <select value={folder} onChange={(event) => setFolder(event.target.value as '' | OfwFolder)} aria-label="Folder">
              {FOLDERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <button type="submit" className="records-submit" disabled={busy || !query.trim()}>
              {busy ? <Loader2 size={16} className="spin" /> : <Search size={16} />} {busy ? 'Searching' : 'Search'}
            </button>
          </div>
          <div className="records-hint">
            <span>{activeMode.hint}</span>
            {!response && (
              <span className="examples">
                Try:{' '}
                {EXAMPLES.map((example) => (
                  <button key={example} type="button" onClick={() => { setQuery(example); setMode(example.startsWith('"') ? 'exact' : 'natural'); }}>
                    {example}
                  </button>
                ))}
              </span>
            )}
          </div>
        </form>
      )}

      {response && <SearchResult response={response} busy={busy} onExport={exportResponse}
        onRetryWithSync={() => lastRequest && run({ ...lastRequest, autoRefresh: true })}
        onCopy={copyCitation} copied={copied} />}
    </section>
  );
}

function ConnectorBadge({ status, hasBridge }: { status: OfwStatus | null; hasBridge: boolean }) {
  if (!hasBridge) return <span className="connector-badge warn">Desktop app required</span>;
  if (!status) return <span className="connector-badge">Checking connector…</span>;
  if (!status.running) return <span className="connector-badge warn" title={status.error}>Connector offline</span>;
  return (
    <span className="connector-badge ok" title={status.command}>
      <ShieldCheck size={14} /> {status.naturalLanguage ? 'Connector · natural-language search' : 'Connector · ranked locally'}
    </span>
  );
}

interface SearchResultProps {
  response: OfwSearchResponse;
  busy: boolean;
  onExport: () => void;
  onRetryWithSync: () => void;
  onCopy: (hit: OfwSearchHit) => void;
  copied: number | null;
}

function SearchResult({ response, busy, onExport, onRetryWithSync, onCopy, copied }: SearchResultProps) {
  if (!response.ok) {
    return (
      <div className="records-alert" role="alert">
        <AlertTriangle size={18} />
        <div>
          <strong>The search could not run.</strong>
          <p className="preline">{response.error}</p>
          {response.setupHint && <p className="muted">{response.setupHint}</p>}
        </div>
      </div>
    );
  }

  const { payload } = response;
  const freshness = payload.freshness;
  const verified = freshness?.asOfDisplay ?? freshness?.asOf;

  return (
    <div className="records-result" aria-live="polite">
      <div className="records-meta">
        <span>
          {response.refused
            ? 'No answer — see below'
            : `${payload.returned ?? 0} of ${payload.totalMatches ?? 0} match${payload.totalMatches === 1 ? '' : 'es'} · ${payload.searched ?? 0} messages searched`}
        </span>
        {verified && <span>Cache verified {verified} ({freshness?.staleness ?? 'unknown'})</span>}
        <span className={`complete-pill ${payload.complete ? 'ok' : 'warn'}`}>{payload.complete ? 'Complete result' : 'Partial / unverified'}</span>
        <span className="muted">{response.engine === 'connector' ? 'Ranked by connector' : 'Ranked locally'}</span>
        <button type="button" className="ghost-launch" onClick={onExport}><Download size={14} /> Export</button>
      </div>

      {payload.interpretation && <Interpretation value={payload.interpretation} />}

      {response.refused && (
        <div className="records-alert" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>{payload.result === 'UNVERIFIED_EMPTY' ? 'Not verified — this is not proof that nothing exists.' : 'The connector declined to answer.'}</strong>
            {payload.reason && <p>{payload.reason}</p>}
            {payload.remedy && <p className="muted">{payload.remedy}</p>}
            <button type="button" className="ghost-launch" onClick={onRetryWithSync} disabled={busy}>
              <RefreshCw size={14} /> Sync with OurFamilyWizard and search again
            </button>
          </div>
        </div>
      )}

      {[payload.completeNote, payload.bodiesNote, payload.note, ...(payload.interpretation?.notes ?? [])]
        .filter((n): n is string => Boolean(n))
        .map((note) => <p key={note} className="records-note">{note}</p>)}

      <ol className="records-hits">
        {(payload.results ?? []).map((hit) => (
          <li key={hit.source.messageId} className="record-hit">
            <div className="record-source">
              <span className="callsign">#{hit.rank} · Message {hit.source.messageId} · {hit.source.folder === 'sent' ? 'Sent' : 'Received'}</span>
              <h3>{hit.source.subject || '(no subject)'}</h3>
              <span className="record-route">
                {hit.source.from ?? 'Unknown sender'} → {hit.source.to.join(', ') || 'Unknown recipient'} · {hit.source.sentAtDisplay ?? hit.source.sentAt}
              </span>
            </div>
            <blockquote className="record-snippet">
              <Quote size={14} aria-hidden />
              <span>{renderSnippet(hit.snippet)}</span>
            </blockquote>
            <div className="record-foot">
              <span className="tag-cloud">
                {hit.matched.map((m) => (
                  <span key={m.query} title={m.via === 'exact' ? 'exact word' : m.via === 'related' ? 'related word' : 'spelling corrected'}>
                    {m.query}{m.matchedAs.length && !(m.matchedAs.length === 1 && m.matchedAs[0] === m.query) ? ` → ${m.matchedAs.join(', ')}` : ''}
                    {m.via !== 'exact' ? ` (${m.via === 'related' ? 'related' : 'spelling'})` : ''}
                  </span>
                ))}
                {(hit.phrasesMatched ?? []).map((p) => <span key={p}>“{p}”</span>)}
                {hit.bodySource && <span>{hit.bodySource === 'preview' ? 'preview only' : 'subject only'}</span>}
              </span>
              <button type="button" className="ghost-launch" onClick={() => onCopy(hit)}>
                <Copy size={14} /> {copied === hit.source.messageId ? 'Copied' : 'Copy citation'}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One line: how the question was read. Every narrowing is visible so none is silent. */
function Interpretation({ value }: { value: OfwInterpretation }) {
  const parts: ReactNode[] = [];
  if (value.mode === 'exact') {
    parts.push(<span key="exact">Exact phrase: <strong>“{value.phrases[0]}”</strong></span>);
  } else {
    if (value.terms.length) {
      parts.push(
        <span key="terms">
          Topic:{' '}
          {value.terms.map((t, i) => (
            <strong key={t.word}>
              {i > 0 ? ', ' : ''}{t.word}
              {t.spellingCorrectedTo ? ` (→ ${t.spellingCorrectedTo.join('/')})` : ''}
              {t.alsoMatching ? ` (+ ${t.alsoMatching.slice(0, 4).join(', ')})` : ''}
            </strong>
          ))}
        </span>
      );
    }
    if (value.phrases.length) parts.push(<span key="phrases">Phrases: <strong>{value.phrases.map((p) => `“${p}”`).join(', ')}</strong></span>);
  }
  if (value.since || value.until) {
    parts.push(
      <span key="dates">
        Dates: <strong>{formatRange(value.since, value.until)}</strong>
        {value.dateExpressions.length ? ` (${value.dateExpressions.join('; ')})` : ''}
      </span>
    );
  }
  if (value.folder) {
    parts.push(<span key="folder">Folder: <strong>{value.folder === 'sent' ? 'sent by me' : 'received'}</strong>{value.folderReason ? ` (${value.folderReason})` : ''}</span>);
  }
  if (value.from?.length) parts.push(<span key="from">From: <strong>{value.from.join(', ')}</strong></span>);
  if (value.to?.length) parts.push(<span key="to">To: <strong>{value.to.join(', ')}</strong></span>);
  if (value.excluded.length) parts.push(<span key="excl">Excluding: <strong>{value.excluded.join(', ')}</strong></span>);
  if (value.hasAttachments) parts.push(<span key="att"><strong>With attachments</strong></span>);
  if (!parts.length) parts.push(<span key="all">All messages (no topic words)</span>);
  return <div className="records-interpretation"><span className="muted">Read as</span>{parts}</div>;
}

function renderSnippet(snippet: string): ReactNode[] {
  return snippet.split(/(«[^»]*»)/g).filter(Boolean).map((part, i) =>
    part.startsWith('«') && part.endsWith('»') ? <mark key={i}>{part.slice(1, -1)}</mark> : <span key={i}>{part}</span>
  );
}

function plainSnippet(snippet: string): string {
  return snippet.replace(/[«»]/g, '');
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** since inclusive, until exclusive (YYYY-MM-DD or ISO) → "Aug 1, 2026 – Aug 31, 2026". */
function formatRange(since?: string, until?: string): string {
  const day = (s: string, minusOne = false) => {
    const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return s;
    if (minusOne) d.setUTCDate(d.getUTCDate() - 1);
    return DATE_FMT.format(d);
  };
  if (since && until) return `${day(since)} – ${day(until, true)}`;
  if (since) return `from ${day(since)}`;
  return `through ${day(until as string, true)}`;
}
