/**
 * Grounded natural-language analysis of OFW records.
 *
 * The earlier design pasted every message, expense and calendar event since
 * 2000 into the system prompt as JSON. On the local model (8,192-token
 * context, ~30 prompt tokens/s) that overflowed the context or took minutes,
 * and nothing tied a claim to a message. Here the question is answered from a
 * small, ranked set of excerpts retrieved by natural-language search, each
 * labelled with its message number, and the model is required to cite them.
 *
 * Pure functions only: no Electron, no network. Tested in
 * tests/ofw-grounding.test.mjs.
 */

export type AnalysisTask = 'answer' | 'summarize' | 'timeline' | 'commitments';

export const ANALYSIS_TASKS: readonly AnalysisTask[] = ['answer', 'summarize', 'timeline', 'commitments'];

export interface GroundingSource {
  messageId: number;
  folder: string;
  subject: string;
  from: string | null;
  to: string[];
  sentAt: string;
  sentAtDisplay?: string;
  /** What the model was shown for this message. */
  excerpt: string;
  /** Only the subject/preview was available (body never fetched). */
  partial: boolean;
}

export interface GroundedPrompt {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  sources: GroundingSource[];
  /** Coverage caveats the answer must carry. */
  caveats: string[];
}

export interface GroundingBudget {
  maxMessages: number;
  maxChars: number;
}

interface SearchHitLike {
  source?: {
    messageId?: unknown; folder?: unknown; subject?: unknown; from?: unknown; to?: unknown; sentAt?: unknown; sentAtDisplay?: unknown;
  };
  snippet?: unknown;
  body?: unknown;
  bodySource?: unknown;
}

const TASK_INSTRUCTIONS: Record<AnalysisTask, string> = {
  answer:
    'Answer the question directly in 1–3 short paragraphs or a short bullet list. Lead with the answer. If the excerpts only partly answer it, say which part is supported and which is not.',
  summarize:
    'Summarize what these messages say about the topic. Group related points under short bold headings. Note where the parents agree, disagree, or leave something unresolved.',
  timeline:
    'Produce a chronological timeline, oldest first, one bullet per event: "- <date> — <what happened or was said> [#id]". Use the dates shown on the excerpts. Do not invent dates.',
  commitments:
    'List every commitment, request, agreement, refusal and unanswered question in the excerpts. One bullet each: "- <who> <committed to / asked for / agreed / refused> <what>, <when or deadline if stated> [#id]". End with any items that appear unresolved.'
};

export const TASK_LABELS: Record<AnalysisTask, string> = {
  answer: 'Answer',
  summarize: 'Summary',
  timeline: 'Timeline',
  commitments: 'Commitments & requests'
};

const SYSTEM_PROMPT = [
  'You analyse OurFamilyWizard co-parenting messages for the account holder. These are legal records.',
  'Rules — follow all of them:',
  '1. Use ONLY the numbered message excerpts provided. Never use outside knowledge, and never guess at facts, intentions or identities the excerpts do not state.',
  '2. End every factual sentence or bullet with the message number(s) it comes from, written exactly like [#123]. A claim without a citation is not allowed.',
  '3. If the excerpts do not contain the answer, say "The retrieved messages don\'t show this." and suggest a narrower search. Do not fill the gap.',
  '4. Report what a message SAYS, not whether it is true: "Sarah wrote that the copay was $40 [#101]". Quote exact words in quotation marks when wording or tone matters.',
  '5. Be neutral and factual. No legal advice, no judgement of either parent, no speculation about motives.',
  '6. Excerpts marked (partial) show only a subject or preview; say so if an answer depends on one.',
  '7. Be concise.'
].join('\n');

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/**
 * The window of `body` around the snippet's matched text, at most `max`
 * characters, whitespace-collapsed. The snippet is where the search found the
 * match, so that is the part of a long message the question is about.
 */
export function excerptAround(body: string, snippet: string, max: number): string {
  const text = body.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const anchorSource = snippet.replace(/[«»]/g, '').replace(/^…\s*/, '').replace(/\s*…$/, '').replace(/\s+/g, ' ').trim();
  const anchor = anchorSource.slice(0, 40);
  const at = anchor ? text.indexOf(anchor) : -1;
  let start = at === -1 ? 0 : Math.max(0, at - Math.floor((max - Math.min(anchorSource.length, max)) / 2));
  start = Math.min(start, text.length - max);
  const end = start + max;
  return `${start > 0 ? '… ' : ''}${text.slice(start, end).trim()}${end < text.length ? ' …' : ''}`;
}

/** Turn ofw_search_messages hits into bounded, labelled excerpts. */
export function buildSources(hits: SearchHitLike[], budget: GroundingBudget): GroundingSource[] {
  const chosen = hits.slice(0, Math.max(1, budget.maxMessages));
  const perMessage = Math.max(200, Math.floor(budget.maxChars / Math.max(1, chosen.length)));
  return chosen.flatMap((hit) => {
    const s = hit.source ?? {};
    const messageId = Number(s.messageId);
    if (!Number.isSafeInteger(messageId)) return [];
    const snippet = str(hit.snippet);
    const body = str(hit.body);
    const partial = !body || hit.bodySource === 'preview' || hit.bodySource === 'none';
    const excerpt = body ? excerptAround(body, snippet, perMessage) : snippet.replace(/[«»]/g, '').slice(0, perMessage);
    return [{
      messageId,
      folder: str(s.folder),
      subject: str(s.subject),
      from: s.from == null ? null : str(s.from),
      to: Array.isArray(s.to) ? s.to.map(str) : [],
      sentAt: str(s.sentAt),
      sentAtDisplay: s.sentAtDisplay == null ? undefined : str(s.sentAtDisplay),
      excerpt,
      partial
    }];
  });
}

export function formatSource(source: GroundingSource): string {
  const when = source.sentAtDisplay || source.sentAt;
  const who = `From ${source.from ?? 'unknown sender'} to ${source.to.join(', ') || 'unknown recipient'}`;
  return `[#${source.messageId}] ${when} · ${who} · Subject: ${source.subject || '(none)'}${source.partial ? ' (partial)' : ''}\n${source.excerpt}`;
}

/** Caveats the answer must carry, from the search payload's own coverage fields. */
export function coverageCaveats(payload: Record<string, unknown>): string[] {
  const caveats: string[] = [];
  if (payload.complete === false) caveats.push('The search result is not verified complete, so relevant messages may be missing.');
  if (typeof payload.bodiesNote === 'string') caveats.push('Some messages have no cached body; only their subject or preview was available.');
  const returned = Number(payload.returned);
  const total = Number(payload.totalMatches);
  if (Number.isFinite(returned) && Number.isFinite(total) && total > returned) {
    caveats.push(`Only the ${returned} most relevant of ${total} matching messages were read.`);
  }
  return caveats;
}

export function buildGroundedPrompt(
  task: AnalysisTask,
  question: string,
  payload: Record<string, unknown>,
  budget: GroundingBudget
): GroundedPrompt {
  const hits = Array.isArray(payload.results) ? (payload.results as SearchHitLike[]) : [];
  let sources = buildSources(hits, budget);
  if (task === 'timeline') sources = [...sources].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const caveats = coverageCaveats(payload);
  const topic = question.trim() || 'the retrieved messages';
  const user = [
    `Task: ${TASK_INSTRUCTIONS[task]}`,
    task === 'answer' ? `Question: ${topic}` : `Topic: ${topic}`,
    caveats.length ? `Coverage limits (mention the relevant ones briefly at the end): ${caveats.join(' ')}` : '',
    `Message excerpts (${sources.length}):`,
    sources.map(formatSource).join('\n\n')
  ].filter(Boolean).join('\n\n');
  return { messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: user }], sources, caveats };
}

/**
 * The block the Qwen chat panel adds to its system prompt for a legal-records
 * turn — the same excerpts and citation rule, sized for a chat context.
 */
export function buildChatContext(question: string, payload: Record<string, unknown>, budget: GroundingBudget): { context: string; sources: GroundingSource[] } {
  const hits = Array.isArray(payload.results) ? (payload.results as SearchHitLike[]) : [];
  const sources = buildSources(hits, budget);
  const caveats = coverageCaveats(payload);
  const context = [
    'OFW message excerpts retrieved for this question (read-only, ranked by relevance):',
    sources.length ? sources.map(formatSource).join('\n\n') : '(No messages matched this question.)',
    caveats.length ? `Coverage limits: ${caveats.join(' ')}` : '',
    'Use only these excerpts for claims about the records, and cite message numbers exactly like [#123]. If they do not answer the question, say so rather than guessing.'
  ].filter(Boolean).join('\n\n');
  return { context, sources };
}

/** OFW content may only go to a model on this machine unless explicitly allowed. */
export function isLoopbackBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

export function groundingBudget(env: Record<string, string | undefined>): GroundingBudget {
  const num = (v: string | undefined, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== undefined && v !== '' ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
  };
  return {
    maxMessages: num(env.OFW_ANALYSIS_MAX_MESSAGES, 8, 1, 20),
    maxChars: num(env.OFW_ANALYSIS_MAX_CHARS, 6000, 1500, 24000)
  };
}
