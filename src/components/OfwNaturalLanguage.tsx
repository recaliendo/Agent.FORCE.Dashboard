import { Fragment, type ReactNode } from 'react';
import { Copy, Quote, Square } from 'lucide-react';
import type { OfwAnalysisTask, OfwGroundingSource } from '../types';

/**
 * Natural-language views for the OFW panel: how a question was read, ranked
 * results with the source in view, and a grounded Qwen analysis whose every
 * claim links back to the message it came from.
 */

type RecordData = Record<string, unknown>;
const rec = (v: unknown): RecordData => (v && typeof v === 'object' && !Array.isArray(v) ? (v as RecordData) : {});
const str = (v: unknown): string => (v == null ? '' : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const ANALYSIS_ACTIONS: Array<{ task: OfwAnalysisTask; label: string; hint: string }> = [
  { task: 'answer', label: 'Answer my question', hint: 'A direct answer, cited to the messages it comes from.' },
  { task: 'summarize', label: 'Summarize', hint: 'What the messages on this topic say, grouped by theme.' },
  { task: 'timeline', label: 'Build timeline', hint: 'Dated events in order, each cited.' },
  { task: 'commitments', label: 'Commitments & requests', hint: 'Who agreed to, asked for, or refused what — and what is unresolved.' }
];

const DATE_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** since inclusive, until exclusive (YYYY-MM-DD) → "Aug 1, 2026 – Aug 31, 2026". */
function formatRange(since?: string, until?: string): string {
  const day = (s: string, minusOne = false) => {
    const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return s;
    if (minusOne) d.setUTCDate(d.getUTCDate() - 1);
    return DATE_FMT.format(d);
  };
  if (since && until) return `${day(since)} – ${day(until, true)}`;
  if (since) return `from ${day(since)}`;
  return `through ${day(str(until), true)}`;
}

/** One line: how the question was read. Every narrowing is visible, so none is silent. */
export function InterpretationLine({ value }: { value: unknown }) {
  const v = rec(value);
  const parts: ReactNode[] = [];
  const terms = arr(v.terms).map(rec);
  const phrases = arr(v.phrases).map(str);
  if (v.mode === 'exact') {
    parts.push(<span key="exact">Exact phrase <strong>“{phrases[0]}”</strong></span>);
  } else {
    if (terms.length) {
      parts.push(
        <span key="terms">Topic{' '}
          {terms.map((t, i) => {
            const also = arr(t.alsoMatching).map(str);
            const fixed = arr(t.spellingCorrectedTo).map(str);
            return (
              <strong key={str(t.word)}>
                {i > 0 ? ', ' : ''}{str(t.word)}
                {fixed.length ? ` (→ ${fixed.join('/')})` : ''}
                {also.length ? ` (+ ${also.slice(0, 4).join(', ')})` : ''}
              </strong>
            );
          })}
        </span>
      );
    }
    if (phrases.length) parts.push(<span key="phrases">Phrases <strong>{phrases.map((p) => `“${p}”`).join(', ')}</strong></span>);
  }
  if (v.since || v.until) {
    const exprs = arr(v.dateExpressions).map(str);
    parts.push(<span key="dates">Dates <strong>{formatRange(str(v.since) || undefined, str(v.until) || undefined)}</strong>{exprs.length ? ` (${exprs.join('; ')})` : ''}</span>);
  }
  if (v.folder) parts.push(<span key="folder">Folder <strong>{v.folder === 'sent' ? 'sent by me' : 'received'}</strong>{v.folderReason ? ` (${str(v.folderReason)})` : ''}</span>);
  const from = arr(v.from).map(str);
  const to = arr(v.to).map(str);
  if (from.length) parts.push(<span key="from">From <strong>{from.join(', ')}</strong></span>);
  if (to.length) parts.push(<span key="to">To <strong>{to.join(', ')}</strong></span>);
  const excluded = arr(v.excluded).map(str);
  if (excluded.length) parts.push(<span key="excl">Excluding <strong>{excluded.join(', ')}</strong></span>);
  if (v.hasAttachments) parts.push(<span key="att"><strong>With attachments</strong></span>);
  if (!parts.length) parts.push(<span key="all">All messages in range (no topic words)</span>);
  const notes = arr(v.notes).map(str).filter(Boolean);
  return (
    <div className="ofw-nl-interpretation">
      <span className="ofw-nl-label">Read as</span>
      {parts}
      {notes.map((n) => <span key={n} className="ofw-nl-note">{n}</span>)}
    </div>
  );
}

/** «matched» → <mark>. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(«[^»]*»)/g).filter(Boolean).map((part, i) =>
        part.startsWith('«') && part.endsWith('»') ? <mark key={i}>{part.slice(1, -1)}</mark> : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  );
}

function citationText(source: RecordData, snippet: string): string {
  return `OurFamilyWizard message #${str(source.messageId)}, "${str(source.subject)}", from ${str(source.from) || 'unknown sender'} to ${arr(source.to).map(str).join(', ') || 'unknown recipient'}, sent ${str(source.sentAtDisplay) || str(source.sentAt)}: ${snippet.replace(/[«»]/g, '')}`;
}

export function NaturalResults({ result, busy, onView, onCopied }: {
  result: RecordData;
  busy: boolean;
  onView: (messageId: string) => void;
  onCopied: (messageId: string) => void;
}) {
  const hits = arr(result.results).map(rec);
  return (
    <ol className="ofw-nl-hits">
      {hits.map((hit) => {
        const s = rec(hit.source);
        const id = str(s.messageId);
        const matched = arr(hit.matched).map(rec);
        const snippet = str(hit.snippet);
        return (
          <li key={id} className="ofw-record ofw-nl-hit" id={`ofw-msg-${id}`}>
            <p className="ofw-source">#{str(hit.rank)} · Message {id} · {s.folder === 'sent' ? 'Sent' : 'Received'} · {str(s.sentAtDisplay) || str(s.sentAt)}</p>
            <h3>{str(s.subject) || '(no subject)'}</h3>
            <p className="ofw-help">{str(s.from) || 'Unknown sender'} → {arr(s.to).map(str).join(', ') || 'Unknown recipient'}</p>
            <blockquote className="ofw-nl-snippet"><Quote size={14} aria-hidden="true" /><span><Marked text={snippet} /></span></blockquote>
            <div className="ofw-nl-foot">
              <span className="ofw-nl-chips">
                {matched.map((m) => {
                  const as = arr(m.matchedAs).map(str);
                  const shown = as.length && !(as.length === 1 && as[0] === str(m.query)) ? ` → ${as.join(', ')}` : '';
                  return <span key={str(m.query)}>{str(m.query)}{shown}{m.via === 'related' ? ' (related)' : m.via === 'spelling' ? ' (spelling)' : ''}</span>;
                })}
                {hit.bodySource ? <span>{hit.bodySource === 'preview' ? 'preview only' : 'subject only'}</span> : null}
              </span>
              <span className="ofw-nl-actions">
                <button type="button" disabled={busy} onClick={() => onView(id)}>View message</button>
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(citationText(s, snippet)).then(() => onCopied(id)).catch(() => undefined); }}>
                  <Copy size={14} /> Copy citation
                </button>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface AnalysisState {
  task: OfwAnalysisTask;
  label: string;
  question: string;
  phase: 'retrieving' | 'thinking' | 'streaming' | 'done' | 'error' | 'cancelled';
  text: string;
  sources: OfwGroundingSource[];
  caveats: string[];
  error?: string;
  startedAt: number;
}

const PHASE_COPY: Record<AnalysisState['phase'], string> = {
  retrieving: 'Finding the relevant messages…',
  thinking: 'Local Qwen is reading the excerpts…',
  streaming: 'Writing…',
  done: 'Done',
  error: 'Stopped',
  cancelled: 'Cancelled'
};

/** Inline text: **bold** and [#123] citations (as buttons that jump to the source). */
function inline(text: string, known: Set<number>, onCite: (id: number) => void): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[#\d+(?:\s*,\s*#?\d+)*\])/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const cite = /^\[#(.+)\]$/.exec(part);
    if (cite) {
      const ids = cite[1].split(/\s*,\s*#?/).map(Number).filter(Number.isFinite);
      return (
        <Fragment key={i}>
          {ids.map((id) => (
            <button key={id} type="button" className={`ofw-cite${known.has(id) ? '' : ' ofw-cite-unknown'}`}
              title={known.has(id) ? `Show message ${id}` : `Message ${id} was not among the excerpts the model was given`}
              onClick={() => onCite(id)}>#{id}</button>
          ))}
        </Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Paragraphs and bullet lists from the model's plain-text/markdown output. */
function CitedText({ text, known, onCite }: { text: string; known: Set<number>; onCite: (id: number) => void }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={`ul-${blocks.length}`}>{bullets.map((b, i) => <li key={i}>{inline(b, known, onCite)}</li>)}</ul>);
    bullets = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) { bullets.push(bullet[1]); continue; }
    flush();
    if (!line) continue;
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    blocks.push(heading
      ? <h4 key={`h-${blocks.length}`}>{inline(heading[1], known, onCite)}</h4>
      : <p key={`p-${blocks.length}`}>{inline(line, known, onCite)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

export function AnalysisView({ state, onCancel, onView }: {
  state: AnalysisState;
  onCancel: () => void;
  onView: (messageId: string) => void;
}) {
  const known = new Set(state.sources.map((s) => s.messageId));
  const cited = new Set(Array.from(state.text.matchAll(/#(\d+)/g), (m) => Number(m[1])));
  const uncited = state.phase === 'done' && state.sources.length > 0 && ![...cited].some((id) => known.has(id));
  const running = state.phase === 'retrieving' || state.phase === 'thinking' || state.phase === 'streaming';
  const jump = (id: number) => {
    const el = document.getElementById(`ofw-src-${id}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ofw-flash'); setTimeout(() => el.classList.remove('ofw-flash'), 1200); }
  };
  return (
    <section className="ofw-nl-analysis" aria-live="polite" aria-busy={running}>
      <div className="ofw-toolbar">
        <strong>{state.label}{state.question ? `: ${state.question}` : ''}</strong>
        <span className="ofw-help">{PHASE_COPY[state.phase]}{running ? '' : ` · ${Math.max(1, Math.round((Date.now() - state.startedAt) / 1000))}s`}</span>
        {running && <button type="button" onClick={onCancel}><Square size={14} /> Stop</button>}
      </div>
      {state.error && <p className="ofw-warning" role="alert">{state.error}</p>}
      {state.text && <div className="ofw-nl-answer"><CitedText text={state.text} known={known} onCite={jump} /></div>}
      {uncited && <p className="ofw-warning">This answer does not cite any message, so treat it as unsupported. Check the sources below directly.</p>}
      {state.caveats.length > 0 && <p className="ofw-help">Limits: {state.caveats.join(' ')}</p>}
      {state.sources.length > 0 && (
        <details open={state.phase !== 'streaming'} className="ofw-nl-sources">
          <summary>{state.sources.length} message excerpt{state.sources.length === 1 ? '' : 's'} given to the model</summary>
          <ol>
            {state.sources.map((s) => (
              <li key={s.messageId} id={`ofw-src-${s.messageId}`}>
                <p className="ofw-source">[#{s.messageId}] {s.sentAtDisplay || s.sentAt} · {s.from ?? 'Unknown sender'} → {s.to.join(', ') || 'Unknown recipient'} · {s.subject || '(no subject)'}{s.partial ? ' · partial' : ''}</p>
                <p className="ofw-nl-excerpt">{s.excerpt}</p>
                <button type="button" onClick={() => onView(String(s.messageId))}>View message</button>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
