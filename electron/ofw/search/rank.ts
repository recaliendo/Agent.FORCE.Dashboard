// Vendored from caliendohomes-rgb/RCOFWMCP src/search/ — see ./row.ts.
/**
 * Relevance ranking for ofw_search_messages.
 *
 * BM25 over subject + body (subject counted double), where each query word is
 * a CONCEPT that may be satisfied by the word itself, a related word
 * ("pickup" ↔ "exchange"), or — only when the word appears nowhere in the
 * record — a close misspelling. Messages that satisfy more of the question
 * rank above ones that repeat one word many times; words that sit close
 * together rank above words scattered across a long message.
 *
 * Every hit carries a snippet cut from the ORIGINAL text with the matched
 * words marked «like this», plus the message's identity, so the source is
 * always in view beside the claim it supports.
 */
import type { MessageRow } from './row.js';
import { fileCountOf, senderOf } from './row.js';
import type { ParsedQuery } from './query.js';
import { editDistance, relatedStems, stem, tokenize, type Token } from './text.js';

export type SearchMode = 'natural' | 'all' | 'exact';

const SUBJECT_WEIGHT = 2;
const SYNONYM_WEIGHT = 0.5;
const FUZZY_WEIGHT = 0.5;
const PHRASE_BONUS = 3;
const K1 = 1.2;
// Below the textbook 0.75: OFW messages range from one line to pages, and full
// length normalisation lets a one-line near-miss outrank a real answer.
const B = 0.6;
const SNIPPET_CHARS = 240;

export interface MatchInfo {
  /** The word from the question. */
  query: string;
  /** What it matched in the record, as written there. */
  matchedAs: string[];
  via: 'exact' | 'related' | 'spelling';
}

export interface SearchHit {
  row: MessageRow;
  score: number;
  matched: MatchInfo[];
  phrasesMatched: string[];
  matchedIn: Array<'subject' | 'body'>;
  snippet: string;
  /** Where the searched text came from: the cached body, OFW's list preview, or nothing but the subject. */
  bodySource: 'body' | 'preview' | 'none';
}

export interface Interpretation {
  mode: SearchMode;
  terms: Array<{ word: string; alsoMatching?: string[]; spellingCorrectedTo?: string[] }>;
  phrases: string[];
  excluded: string[];
  since?: string;
  until?: string;
  dateExpressions: string[];
  folder?: 'inbox' | 'sent';
  folderReason?: string;
  from?: string[];
  to?: string[];
  hasAttachments?: boolean;
  notes: string[];
}

export interface SearchResult {
  hits: SearchHit[];
  interpretation: Interpretation;
  /** Candidates in the window whose body was never fetched, so only subject/preview was searched. */
  bodiesMissing: number;
}

interface Variant { stem: string; weight: number; via: MatchInfo['via'] }
interface Concept { word: string; variants: Variant[] }

interface Doc {
  row: MessageRow;
  subject: string;
  body: string;
  bodySource: SearchHit['bodySource'];
  subjTokens: Token[];
  bodyTokens: Token[];
  subjTf: Map<string, number>;
  bodyTf: Map<string, number>;
  length: number;
}

function counts(tokens: Token[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t.stem, (m.get(t.stem) ?? 0) + 1);
  return m;
}

function previewOf(row: MessageRow): string | null {
  const ld = row.listData as { preview?: unknown } | null;
  return ld !== null && typeof ld === 'object' && typeof ld.preview === 'string' ? ld.preview : null;
}

function buildDoc(row: MessageRow): Doc {
  const subject = row.subject;
  const preview = previewOf(row);
  const body = row.body ?? preview ?? '';
  const bodySource: Doc['bodySource'] = row.body != null ? 'body' : preview !== null ? 'preview' : 'none';
  const subjTokens = tokenize(subject);
  const bodyTokens = tokenize(body);
  return {
    row, subject, body, bodySource, subjTokens, bodyTokens,
    subjTf: counts(subjTokens),
    bodyTf: counts(bodyTokens),
    length: SUBJECT_WEIGHT * subjTokens.length + bodyTokens.length,
  };
}

const collapse = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ');

function containsPhrase(doc: Doc, phrase: string): boolean {
  const p = collapse(phrase);
  return collapse(doc.subject).includes(p) || collapse(doc.body).includes(p);
}

/** Edits allowed when correcting a word: none for short words or numbers, where one edit is a different word. */
function fuzzyLimit(s: string): number {
  if (/\d/.test(s)) return 0;
  return s.length >= 7 ? 2 : s.length >= 4 ? 1 : 0;
}

/** Does `name` (from the question) refer to `known` (a real sender/recipient)? */
function nameMatches(name: string, known: string): boolean {
  const n = name.toLowerCase().trim();
  const k = known.toLowerCase();
  if (k === n || k.includes(n)) return true;
  // First-name typo tolerance: "Sara" → "Sarah Smith".
  const kFirst = k.split(/\s+/)[0];
  const nFirst = n.split(/\s+/)[0];
  return nFirst.length >= 4 && editDistance(nFirst, kFirst, 1) <= 1;
}

function recipientNames(row: MessageRow): string[] {
  return row.recipients.map((r) => r.name).filter((n): n is string => typeof n === 'string' && n !== '');
}

/**
 * Rank `rows` (already narrowed to the folder/date window) against a parsed
 * question. Pure and deterministic.
 */
export function rankMessages(rows: MessageRow[], q: ParsedQuery, mode: SearchMode): SearchResult {
  const notes: string[] = [];
  const interp: Interpretation = {
    mode,
    terms: [],
    phrases: q.phrases,
    excluded: q.excluded,
    since: q.since,
    until: q.until,
    dateExpressions: q.dateExpressions,
    folder: q.folder,
    folderReason: q.folderReason,
    hasAttachments: q.hasAttachments,
    notes,
  };

  let candidates = rows;

  // People: keep a named person as a FILTER only when someone in the record
  // answers to it; otherwise the words go back into the topic.
  const terms = [...q.terms];
  const knownSenders = new Set<string>();
  const knownRecipients = new Set<string>();
  for (const r of rows) {
    const s = senderOf(r);
    if (s) knownSenders.add(s);
    for (const n of recipientNames(r)) knownRecipients.add(n);
  }
  for (const p of q.people) {
    const pool = p.role === 'from' ? knownSenders : knownRecipients;
    const hits = [...pool].filter((k) => nameMatches(p.name, k));
    if (hits.length === 0) {
      terms.push(...tokenize(p.name).map((t) => t.norm));
      if (/^\p{Lu}/u.test(p.name)) notes.push(`No ${p.role === 'from' ? 'sender' : 'recipient'} in the searched messages matches "${p.name}", so it was searched as a word instead.`);
      continue;
    }
    const key = p.role === 'from' ? 'from' : 'to';
    interp[key] = [...(interp[key] ?? []), ...hits];
    candidates = candidates.filter((r) => (p.role === 'from'
      ? hits.some((h) => h === senderOf(r))
      : recipientNames(r).some((n) => hits.includes(n))));
  }

  if (q.hasAttachments) candidates = candidates.filter((r) => (fileCountOf(r) ?? 0) > 0);

  const docs = candidates.map(buildDoc);
  const bodiesMissing = docs.filter((d) => d.bodySource !== 'body').length;

  // Exclusions, before scoring so they cannot shape idf.
  const excludedStems = q.excluded.filter((e) => !/\s/.test(e)).flatMap((e) => tokenize(e).map((t) => t.stem));
  const excludedPhrases = q.excluded.filter((e) => /\s/.test(e));
  const kept = docs.filter((d) => {
    if (excludedStems.some((s) => d.subjTf.has(s) || d.bodyTf.has(s))) return false;
    if (excludedPhrases.some((p) => containsPhrase(d, p))) return false;
    return true;
  });
  const phrasesOk = kept.filter((d) => q.phrases.every((p) => containsPhrase(d, p)));

  // Document frequencies over the searchable set.
  const df = new Map<string, number>();
  // How each stem is first written in the record, so `interpretation` can say
  // "reimburse" rather than the stemmer's "reimburs".
  const written = new Map<string, string>();
  for (const d of phrasesOk) {
    const seen = new Set<string>([...d.subjTf.keys(), ...d.bodyTf.keys()]);
    for (const s of seen) df.set(s, (df.get(s) ?? 0) + 1);
    for (const t of [...d.subjTokens, ...d.bodyTokens]) if (!written.has(t.stem)) written.set(t.stem, t.norm);
  }
  const asWritten = (s: string): string => written.get(s) as string;
  const N = phrasesOk.length;
  const avgLen = Math.max(1, phrasesOk.reduce((a, d) => a + d.length, 0) / Math.max(1, N));
  const idf = (s: string): number => {
    // Only ever asked about stems that occur (a variant with tf > 0, or an exact stem checked with df.has).
    const n = df.get(s) as number;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  };

  // Build concepts.
  const concepts: Concept[] = [];
  const seenStems = new Set<string>();
  // Each word the question states is matched exactly for ITSELF only: in
  // "dentist appointment", a message saying "appointment" must not also count
  // as a related hit for "dentist", or one word would satisfy two concepts.
  const termTokens = terms.flatMap((w) => tokenize(w));
  const queryStems = new Set(termTokens.map((t) => t.stem));
  for (const tok of termTokens) {
    // A name that fell back to a word can repeat a topic word already asked.
    if (seenStems.has(tok.stem)) continue;
    seenStems.add(tok.stem);
    const variants: Variant[] = [{ stem: tok.stem, weight: 1, via: 'exact' }];
    const entry: Interpretation['terms'][number] = { word: tok.norm };
    // Exact mode never reaches here: its query is one phrase and no terms.
    const related = relatedStems(tok.stem).filter((s) => df.has(s) && !queryStems.has(s));
    for (const s of related) variants.push({ stem: s, weight: SYNONYM_WEIGHT, via: 'related' });
    if (related.length > 0) entry.alsoMatching = related.map(asWritten);
    // Spelling correction only for a word the record never uses in any form —
    // never second-guess a word that is actually there.
    const max = fuzzyLimit(tok.stem);
    if (!df.has(tok.stem) && related.length === 0 && max > 0) {
      const close = [...df.keys()]
        .filter((s) => s[0] === tok.stem[0] && editDistance(s, tok.stem, max) <= max)
        .sort((a, b) => (df.get(b) as number) - (df.get(a) as number) || a.localeCompare(b))
        .slice(0, 3);
      for (const s of close) variants.push({ stem: s, weight: FUZZY_WEIGHT, via: 'spelling' });
      if (close.length > 0) entry.spellingCorrectedTo = close.map(asWritten);
    }
    interp.terms.push(entry);
    concepts.push({ word: tok.norm, variants });
  }

  if (concepts.length > 0 && concepts.every((c) => c.variants.every((v) => !df.has(v.stem)))) {
    notes.push('None of the search words appear anywhere in the searched messages (including related words and close spellings).');
  }

  const hits: SearchHit[] = [];
  for (const d of phrasesOk) {
    let score = 0;
    const matched: MatchInfo[] = [];
    const matchedStemsByConcept: Array<Set<string>> = [];
    for (const c of concepts) {
      let best = 0;
      let bestVia: MatchInfo['via'] = 'exact';
      const stems = new Set<string>();
      for (const v of c.variants) {
        const tf = SUBJECT_WEIGHT * (d.subjTf.get(v.stem) ?? 0) + (d.bodyTf.get(v.stem) ?? 0);
        if (tf === 0) continue;
        stems.add(v.stem);
        // A related or corrected word never earns more rarity credit than the
        // word actually asked for — otherwise a rare synonym ("pediatrician")
        // outranks the common exact word ("dentist") it stands in for.
        const exactStem = c.variants[0].stem;
        const rarity = v.via === 'exact' || !df.has(exactStem) ? idf(v.stem) : Math.min(idf(v.stem), idf(exactStem));
        const s = v.weight * rarity * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * d.length / avgLen));
        if (s > best) { best = s; bestVia = v.via; }
      }
      if (stems.size > 0) {
        score += best;
        matchedStemsByConcept.push(stems);
        const surfaces = new Set<string>();
        for (const t of [...d.subjTokens, ...d.bodyTokens]) {
          if (stems.has(t.stem)) surfaces.add(t.norm);
        }
        matched.push({ query: c.word, matchedAs: [...surfaces].slice(0, 5), via: bestVia });
      }
    }

    const coverage = concepts.length === 0 ? 1 : matched.length / concepts.length;
    if (concepts.length > 0 && matched.length === 0 && q.phrases.length === 0) continue;
    if (mode === 'all' && matched.length < concepts.length) continue;

    score *= coverage ** 1.5;
    score += PHRASE_BONUS * q.phrases.length;

    // Proximity: the tightest body window holding one hit from every matched concept.
    if (matchedStemsByConcept.length >= 2) {
      const span = minSpan(d.bodyTokens, matchedStemsByConcept);
      if (span !== null) score *= span <= 12 ? 1.25 : span <= 40 ? 1.1 : 1;
    }

    const allStems = new Set<string>(matchedStemsByConcept.flatMap((s) => [...s]));
    const matchedIn: SearchHit['matchedIn'] = [];
    const subjHit = d.subjTokens.some((t) => allStems.has(t.stem)) || q.phrases.some((p) => collapse(d.subject).includes(collapse(p)));
    const bodyHit = d.bodyTokens.some((t) => allStems.has(t.stem)) || q.phrases.some((p) => collapse(d.body).includes(collapse(p)));
    if (subjHit) matchedIn.push('subject');
    if (bodyHit) matchedIn.push('body');

    hits.push({
      row: d.row,
      score: Math.round(score * 1000) / 1000,
      matched,
      phrasesMatched: [...q.phrases],
      matchedIn,
      snippet: snippet(d, allStems, q.phrases, matchedStemsByConcept),
      bodySource: d.bodySource,
    });
  }

  hits.sort((a, b) => b.score - a.score || b.row.sentAt.localeCompare(a.row.sentAt) || b.row.id - a.row.id);
  return { hits, interpretation: interp, bodiesMissing };
}

/** Smallest token span in `tokens` that contains at least one stem from every group. */
function minSpan(tokens: Token[], groups: Array<Set<string>>): number | null {
  const pos: Array<{ i: number; g: number }> = [];
  tokens.forEach((t, i) => groups.forEach((set, g) => { if (set.has(t.stem)) pos.push({ i, g }); }));
  const need = groups.length;
  const have = new Map<number, number>();
  let best: number | null = null;
  let lo = 0;
  for (let hi = 0; hi < pos.length; hi++) {
    have.set(pos[hi].g, (have.get(pos[hi].g) ?? 0) + 1);
    while (have.size === need) {
      const span = pos[hi].i - pos[lo].i + 1;
      if (best === null || span < best) best = span;
      const g = pos[lo].g;
      const c = (have.get(g) as number) - 1;
      if (c === 0) have.delete(g); else have.set(g, c);
      lo++;
    }
  }
  return best;
}

interface Span { start: number; end: number; group: number }

/**
 * The most informative ~240-character window of the body, matched words
 * wrapped in «», whitespace collapsed. Falls back to the subject when the
 * body holds none of the matches.
 */
function snippet(d: Doc, stems: Set<string>, phrases: string[], groups: Array<Set<string>>): string {
  const spansIn = (text: string, tokens: Token[]): Span[] => {
    const spans: Span[] = [];
    for (const t of tokens) {
      if (!stems.has(t.stem)) continue;
      const group = groups.findIndex((g) => g.has(t.stem));
      spans.push({ start: t.start, end: t.end, group });
    }
    const lower = text.toLowerCase();
    phrases.forEach((p, pi) => {
      const needle = p.toLowerCase();
      // Literal search on the raw text; a phrase whose whitespace differs
      // from the source still matched (collapsed) but is simply not marked.
      for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
        spans.push({ start: at, end: at + needle.length, group: groups.length + pi });
      }
    });
    spans.sort((a, b) => a.start - b.start || b.end - a.end);
    // Drop spans nested inside an earlier one (a word inside a marked phrase).
    const flat: Span[] = [];
    for (const s of spans) if (flat.length === 0 || s.start >= flat[flat.length - 1].end) flat.push(s);
    return flat;
  };

  const mark = (text: string, spans: Span[], from: number, to: number): string => {
    let out = '';
    let cur = from;
    for (const s of spans) {
      if (s.start < from || s.end > to) continue;
      out += text.slice(cur, s.start) + '«' + text.slice(s.start, s.end) + '»';
      cur = s.end;
    }
    return (out + text.slice(cur, to)).replace(/\s+/g, ' ').trim();
  };

  const bodySpans = spansIn(d.body, d.bodyTokens);
  if (bodySpans.length === 0) {
    const subjSpans = spansIn(d.subject, d.subjTokens);
    if (d.body === '') return mark(d.subject, subjSpans, 0, d.subject.length);
    const head = d.body.slice(0, SNIPPET_CHARS);
    return mark(d.body, [], 0, head.length) + (d.body.length > SNIPPET_CHARS ? ' …' : '');
  }

  // Window that covers the most distinct concepts (earliest on a tie).
  let bestStart = bodySpans[0].start;
  let bestCount = -1;
  for (const s of bodySpans) {
    const groupsIn = new Set(bodySpans.filter((x) => x.start >= s.start && x.end <= s.start + SNIPPET_CHARS).map((x) => x.group));
    if (groupsIn.size > bestCount) { bestCount = groupsIn.size; bestStart = s.start; }
  }
  // Lead in with a little context, snapped to a nearby word boundary — but
  // only nearby: in text with no spaces (a pasted URL, a long number), snapping
  // to the previous space could drag the window off the match entirely.
  let from = Math.max(0, bestStart - 60);
  const back = d.body.lastIndexOf(' ', from);
  if (back !== -1 && from - back <= 20) from = back + 1;
  let to = Math.min(d.body.length, from + SNIPPET_CHARS);
  const fwd = d.body.indexOf(' ', to);
  if (fwd !== -1 && fwd - to <= 20) to = fwd;
  // Never cut a marked span in half.
  for (const s of bodySpans) if (s.start < to && s.end > to) to = s.end;
  return (from > 0 ? '… ' : '') + mark(d.body, bodySpans, from, to) + (to < d.body.length ? ' …' : '');
}
