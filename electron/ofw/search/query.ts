// Vendored from caliendohomes-rgb/RCOFWMCP src/search/ — see ./row.ts.
/**
 * Natural-language query understanding for ofw_search_messages.
 *
 * Turns "what did she say about the dentist last month, not the ortho" into a
 * structured query: topic words, a date window, a folder, exclusions. Every
 * decision is echoed back in `interpretation` so the caller can see — and
 * correct — how the question was read. A search over a legal record must
 * never silently narrow itself.
 */
import { STOPWORDS, tokenize } from './text.js';

export type FolderIntent = 'inbox' | 'sent';

export interface PersonFilter {
  role: 'from' | 'to';
  name: string;
}

export interface ParsedQuery {
  raw: string;
  /** Topic words, lowercased surface forms, stopwords removed, in query order. */
  terms: string[];
  /** Quoted text, matched literally (case-insensitive, whitespace-collapsed). */
  phrases: string[];
  /** Words or phrases whose presence removes a message from the results. */
  excluded: string[];
  /** Naive local date bounds (YYYY-MM-DD), same shape the cache's sent_at compares against. */
  since?: string;
  until?: string;
  /** Human-readable account of each date expression recognised. */
  dateExpressions: string[];
  folder?: FolderIntent;
  folderReason?: string;
  /** Named people ("from Sarah", "to Mike"). Resolved against real senders at rank time. */
  people: PersonFilter[];
  hasAttachments?: boolean;
}

// ── Plain-date arithmetic (UTC-backed so DST never shifts a calendar day) ──

interface Ymd { y: number; m: number; d: number }

const toDate = ({ y, m, d }: Ymd): Date => new Date(Date.UTC(y, m - 1, d));
const fromDate = (dt: Date): Ymd => ({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
const fmt = (v: Ymd): string =>
  `${String(v.y).padStart(4, '0')}-${String(v.m).padStart(2, '0')}-${String(v.d).padStart(2, '0')}`;
const addDays = (v: Ymd, n: number): Ymd => {
  const dt = toDate(v);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromDate(dt);
};
const addMonths = (v: Ymd, n: number): Ymd => {
  const total = v.y * 12 + (v.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { y, m, d: Math.min(v.d, lastDay) };
};
const cmp = (a: Ymd, b: Ymd): number => toDate(a).getTime() - toDate(b).getTime();
const validYmd = (v: Ymd): boolean => {
  if (v.m < 1 || v.m > 12 || v.d < 1) return false;
  return v.d <= new Date(Date.UTC(v.y, v.m, 0)).getUTCDate();
};

/** Today's calendar date in `tz` — the zone OFW's naive timestamps are in. */
export function localToday(now: Date, tz: string): Ymd {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

interface Range { start: Ymd; end: Ymd }  // end exclusive

// ── Date grammar ──

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTHS_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const UNIT_RE = 'days?|weeks?|months?|years?';
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  a: 1, an: 1, couple: 2, few: 3, several: 3,
};

/** Relative expressions: "last week", "past 3 months", "2 weeks ago", "yesterday". */
const REL_RE = `today|yesterday|(?:this|last|past|previous)\\s+(?:week|month|year)|(?:the\\s+)?(?:last|past)\\s+\\d+\\s+(?:${UNIT_RE})|\\d+\\s+(?:${UNIT_RE})\\s+ago`;
/** A date that names itself unambiguously — safe to recognise even with no preposition. */
const EXPLICIT_RE = `\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?|(?:${MONTHS_RE})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|(?:${MONTHS_RE})\\.?,?\\s+\\d{4}`;
/**
 * Anything usable after a preposition. A bare month ("may", "march") and a
 * bare year are only dates in that position — "she may be late" is not May.
 */
const ANY_DATE_RE = `${REL_RE}|${EXPLICIT_RE}|(?:${MONTHS_RE})|(?:19|20)\\d{2}`;
/**
 * The subset recognised with NO preposition. Excludes a year-less "1/2",
 * which is as likely to be "1/2 the cost" as January 2nd.
 */
const BARE_DATE_RE = `${REL_RE}|\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}/\\d{1,2}/\\d{2,4}|(?:${MONTHS_RE})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|(?:${MONTHS_RE})\\.?,?\\s+\\d{4}`;

function monthIndex(word: string): number {
  const w = word.toLowerCase().replace(/\.$/, '');
  return MONTH_NAMES.findIndex((name) => name.startsWith(w.slice(0, 3))) + 1;
}

/** The most recent occurrence of month (and day) that is not in the future. */
function mostRecent(today: Ymd, m: number, d?: number): number {
  const candidate: Ymd = { y: today.y, m, d: d ?? 1 };
  return cmp(candidate, today) > 0 ? today.y - 1 : today.y;
}

function unitRange(today: Ymd, n: number, unit: string, ago: boolean): Range {
  const u = unit.replace(/s$/, '');
  const back = (k: number): Ymd => (u === 'day' ? addDays(today, -k)
    : u === 'week' ? addDays(today, -7 * k)
      : u === 'month' ? addMonths(today, -k)
        : addMonths(today, -12 * k));
  if (ago) {
    // "3 weeks ago": the unit-long window that began N units back.
    const start = back(n);
    const end = u === 'day' ? addDays(start, 1) : u === 'week' ? addDays(start, 7) : u === 'month' ? addMonths(start, 1) : addMonths(start, 12);
    return { start, end };
  }
  return { start: back(n), end: addDays(today, 1) };
}

/**
 * Resolve one date expression to a [start, end) window, or null if it is not one.
 *
 * `contextYear` is a year named elsewhere in the same question: in "in 2025
 * before June", June is June 2025, not the most recent June.
 */
function resolveDate(exprRaw: string, today: Ymd, contextYear?: number): Range | null {
  const expr = exprRaw.toLowerCase().trim().replace(/\s+/g, ' ');
  const tomorrow = addDays(today, 1);

  if (expr === 'today') return { start: today, end: tomorrow };
  if (expr === 'yesterday') return { start: addDays(today, -1), end: today };

  let m = /^(this|last|past|previous) (week|month|year)$/.exec(expr);
  if (m) {
    const which = m[1] === 'this' ? 0 : -1;
    if (m[2] === 'week') {
      // Weeks start Monday. "this week" runs to tomorrow; "last week" is the full prior Mon–Sun.
      const dow = (toDate(today).getUTCDay() + 6) % 7;
      const monday = addDays(today, -dow);
      if (m[1] === 'past') return { start: addDays(today, -7), end: tomorrow };
      return which === 0 ? { start: monday, end: tomorrow } : { start: addDays(monday, -7), end: monday };
    }
    if (m[2] === 'month') {
      const first: Ymd = { y: today.y, m: today.m, d: 1 };
      if (m[1] === 'past') return { start: addMonths(today, -1), end: tomorrow };
      return which === 0 ? { start: first, end: tomorrow } : { start: addMonths(first, -1), end: first };
    }
    const jan1: Ymd = { y: today.y, m: 1, d: 1 };
    if (m[1] === 'past') return { start: addMonths(today, -12), end: tomorrow };
    return which === 0 ? { start: jan1, end: tomorrow } : { start: { y: today.y - 1, m: 1, d: 1 }, end: jan1 };
  }

  m = new RegExp(`^(?:the )?(?:last|past) (\\d+) (${UNIT_RE})$`).exec(expr);
  if (m) return unitRange(today, Number(m[1]), m[2], false);
  m = new RegExp(`^(\\d+) (${UNIT_RE}) ago$`).exec(expr);
  if (m) return unitRange(today, Number(m[1]), m[2], true);

  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(expr);
  if (m) {
    const v = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
    return validYmd(v) ? { start: v, end: addDays(v, 1) } : null;
  }
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(expr);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    const y = m[3] === undefined ? contextYear ?? mostRecent(today, mo, d) : m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const v = { y, m: mo, d };
    return validYmd(v) ? { start: v, end: addDays(v, 1) } : null;
  }
  m = new RegExp(`^(${MONTHS_RE})\\.? (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?$`).exec(expr);
  if (m) {
    const mo = monthIndex(m[1]);
    const d = Number(m[2]);
    const y = m[3] === undefined ? contextYear ?? mostRecent(today, mo, d) : Number(m[3]);
    const v = { y, m: mo, d };
    return validYmd(v) ? { start: v, end: addDays(v, 1) } : null;
  }
  m = new RegExp(`^(${MONTHS_RE})\\.?,? (\\d{4})$`).exec(expr);
  if (m) {
    const start = { y: Number(m[2]), m: monthIndex(m[1]), d: 1 };
    return { start, end: addMonths(start, 1) };
  }
  m = new RegExp(`^(${MONTHS_RE})$`).exec(expr);
  if (m) {
    const mo = monthIndex(m[1]);
    const start = { y: contextYear ?? mostRecent(today, mo), m: mo, d: 1 };
    return { start, end: addMonths(start, 1) };
  }
  // Only strings the date regexes matched reach here, so the last form is a bare year.
  const y = Number(expr);
  return { start: { y, m: 1, d: 1 }, end: { y: y + 1, m: 1, d: 1 } };
}

// ── Folder / people / attachment intent ──

// "to her" is the co-parent only when "her" is an object, not a possessive:
// "I wrote to her about camp" is, "I talked to her teacher" is not.
const OBJECT_FOLLOWS = '(?=\\s*(?:$|[,.?!;:]|(?:about|regarding|re|on|in|during|since|before|after|last|this|that|when|where|with|and|or|between|from|until|asking|saying|telling|mentioning|if|whether)\\b))';
const COPARENT = `her${OBJECT_FOLLOWS}|him|them|my ex-?wife|my ex-?husband|ex-?wife|ex-?husband|my ex|the ex|ex|my co-?parent|the co-?parent|co-?parent|the other parent|other parent|the mother|the father|mother|father|mom|dad`;
const NOT_A_NAME = new Set([
  ...STOPWORDS, 'her', 'him', 'them', 'me', 'us', 'ex', 'coparent', 'co', 'parent', 'mother', 'father', 'mom', 'dad',
  'school', 'the', 'my', 'last', 'this', 'next', 'yesterday', 'today',
]);

function wordNumbersToDigits(s: string): string {
  const words = Object.keys(WORD_NUMBERS).join('|');
  return s.replace(new RegExp(`\\b(?:a\\s+)?(${words})\\s+(${UNIT_RE})\\b`, 'gi'), (_all, w: string, unit: string) => {
    const n = WORD_NUMBERS[w.toLowerCase()];
    // "a week" / "a couple weeks" → singular/plural stays grammatical for the unit regex.
    return `${n} ${unit}`;
  }).replace(/\bcouple\s+of\s+(\d+)/gi, '$1');
}

/**
 * Parse a natural-language question into a structured search.
 *
 * `now` and `tz` pin relative dates ("last week") to the account's calendar,
 * not the server's.
 */
export function parseQuery(input: string, now: Date, tz: string): ParsedQuery {
  const out: ParsedQuery = { raw: input, terms: [], phrases: [], excluded: [], dateExpressions: [], people: [] };
  const today = localToday(now, tz);
  let s = ` ${input.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")} `;
  const cut = (re: RegExp, fn: (...groups: string[]) => void): void => {
    s = s.replace(re, (...args: unknown[]) => {
      fn(...(args.slice(0, -2) as string[]));
      return ' ';
    });
  };

  // 1. Quoted phrases — literal, and removed before anything else parses inside them.
  //    A quoted phrase after an exclusion keyword is an exclusion, not a requirement.
  cut(/(?:\s-|\b(?:excluding|except|but not|NOT|without (?:the words?|mentioning))\s+)"([^"]+)"/g, (_a, p) => {
    if (p.trim()) out.excluded.push(p.trim().toLowerCase());
  });
  cut(/"([^"]+)"/g, (_a, p) => {
    if (p.trim()) out.phrases.push(p.trim());
  });

  // 2. Exclusions: -word, NOT word (capitalised, so ordinary "not" in a sentence is left alone),
  //    "excluding x", "except x", "but not x", "without mentioning x".
  cut(/(?:^|\s)-([\p{L}\p{N}][\p{L}\p{N}'-]*)/gu, (_a, w) => out.excluded.push(w.toLowerCase()));
  cut(/\b(?:NOT|excluding|except(?: for)?|but not|without (?:the words?|mentioning))\s+([\p{L}\p{N}][\p{L}\p{N}'-]*)/gu, (_a, w) => out.excluded.push(w.toLowerCase()));

  // 3. Dates.
  s = wordNumbersToDigits(s);
  const bounds: Range[] = [];
  const yearMentions = [...s.matchAll(/\b(?:in|during|of|for)\s+((?:19|20)\d{2})\b/gi)].map((m) => Number(m[1]));
  const contextYear = new Set(yearMentions).size === 1 ? yearMentions[0] : undefined;
  const resolve = (expr: string): Range | null => resolveDate(expr, today, contextYear);
  const addRange = (label: string, r: Range | null, kind: 'in' | 'since' | 'after' | 'before' | 'until'): void => {
    if (r === null) return;
    const range = kind === 'in' ? r
      : kind === 'since' ? { start: r.start, end: { y: 9999, m: 12, d: 31 } }
        : kind === 'after' ? { start: r.end, end: { y: 9999, m: 12, d: 31 } }
          : kind === 'before' ? { start: { y: 1, m: 1, d: 1 }, end: r.start }
            : { start: { y: 1, m: 1, d: 1 }, end: r.end };
    bounds.push(range);
    out.dateExpressions.push(label.trim().replace(/\s+/g, ' '));
  };
  const D = `(${ANY_DATE_RE})`;
  const E = `(${BARE_DATE_RE})`;
  cut(new RegExp(`\\b(?:between|from)\\s+${D}\\s+(?:and|to|through|thru|until|till|-)\\s+${D}\\b`, 'gi'), (all, a, b) => {
    const ra = resolve(a);
    const rb = resolve(b);
    if (ra && rb) {
      bounds.push({ start: ra.start, end: rb.end });
      out.dateExpressions.push(all.trim().replace(/\s+/g, ' '));
    }
  });
  cut(new RegExp(`\\b(since|starting|from)\\s+(?:the\\s+)?${D}\\b`, 'gi'), (all, _k, d) => addRange(all, resolve(d), 'since'));
  cut(new RegExp(`\\b(after)\\s+(?:the\\s+)?${D}\\b`, 'gi'), (all, _k, d) => addRange(all, resolve(d), 'after'));
  cut(new RegExp(`\\b(before|prior to)\\s+(?:the\\s+)?${D}\\b`, 'gi'), (all, _k, d) => addRange(all, resolve(d), 'before'));
  cut(new RegExp(`\\b(until|till|through|thru|up to)\\s+(?:the\\s+)?${D}\\b`, 'gi'), (all, _k, d) => addRange(all, resolve(d), 'until'));
  cut(new RegExp(`\\b(?:in|during|on|of|within|over|for)\\s+(?:the\\s+)?${D}\\b`, 'gi'), (all, d) => addRange(all, resolve(d), 'in'));
  cut(new RegExp(`\\b${E}\\b`, 'gi'), (all, d) => addRange(all, resolve(d), 'in'));
  if (bounds.length > 0) {
    // Several expressions intersect ("in 2025 before June" = Jan–May 2025).
    let start = bounds[0].start;
    let end = bounds[0].end;
    for (const b of bounds.slice(1)) {
      if (cmp(b.start, start) > 0) start = b.start;
      if (cmp(b.end, end) < 0) end = b.end;
    }
    if (start.y > 1) out.since = fmt(start);
    if (end.y < 9999) out.until = fmt(end);
  }

  // 4. Attachments.
  cut(/\b(?:with|has|have|having|that have|containing|including)\s+(?:an?\s+|any\s+|some\s+)?(?:attachments?|attached files?|files?|photos?|pictures?|images?|pdfs?|documents?|screenshots?)\b|\battached\b/gi, () => {
    out.hasAttachments = true;
  });

  // 5. Folder intent. "I" is the account holder; everyone else writes to the inbox.
  let sent = false;
  let inbox = false;
  const sentWhy: string[] = [];
  const inboxWhy: string[] = [];
  cut(/\b(?:i|we)\s+(?:have\s+|had\s+)?(?:sent|wrote|said|told|asked|mentioned|promised|agreed|offered|replied|responded|answered|proposed|suggested|requested|emailed|messaged)\b/gi, (all) => { sent = true; sentWhy.push(all.trim()); });
  cut(/\bdid\s+(?:i|we)\b/gi, (all) => { sent = true; sentWhy.push(all.trim()); });
  cut(/\b(?:from|by)\s+me\b|\bmy\s+(?:own\s+)?(?:messages?|replies|replys|responses?)\b|\b(?:in\s+)?(?:my\s+)?sent\s+(?:folder|items|box)\b|\bi\s+sent\b/gi, (all) => { sent = true; sentWhy.push(all.trim()); });
  cut(new RegExp(`\\bto\\s+(?:${COPARENT})\\b`, 'gi'), (all) => { sent = true; sentWhy.push(all.trim()); });
  cut(/\b(?:she|he|they)\s+(?:has\s+|had\s+)?(?:sent|wrote|said|say|says|told|asked|mentioned|promised|agreed|offered|replied|responded|answered|proposed|suggested|requested|emailed|messaged|claimed|complained)\b/gi, (all) => { inbox = true; inboxWhy.push(all.trim()); });
  cut(/\bdid\s+(?:she|he|they)\b/gi, (all) => { inbox = true; inboxWhy.push(all.trim()); });
  cut(new RegExp(`\\b(?:from|by)\\s+(?:${COPARENT})\\b`, 'gi'), (all) => { inbox = true; inboxWhy.push(all.trim()); });
  cut(/\bto\s+me\b|\b(?:messages?\s+)?i\s+(?:received|got)\b|\breceived\b|\b(?:in\s+)?(?:my\s+)?inbox\b/gi, (all) => { inbox = true; inboxWhy.push(all.trim()); });
  if (sent !== inbox) {
    out.folder = sent ? 'sent' : 'inbox';
    out.folderReason = `"${(sent ? sentWhy : inboxWhy)[0]}"`;
  }

  // 6. Named people: "from Sarah", "to Mike Smith". Only a candidate here — the
  //    ranker keeps it as a filter only if a real sender/recipient matches.
  cut(/\b(from|by|to)\s+([\p{L}][\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]+)?)/gu, (all, role, name) => {
    const first = name.split(/\s+/)[0].toLowerCase();
    if (NOT_A_NAME.has(first)) {
      // Not a person — put the words back for the topic pass.
      s += ` ${name} `;
      return;
    }
    out.people.push({ role: role.toLowerCase() === 'to' ? 'to' : 'from', name });
  });

  // 7. What remains is the topic.
  const seen = new Set<string>();
  for (const tok of tokenize(s)) {
    if (STOPWORDS.has(tok.norm) || tok.norm.length < 2 && !/\d/.test(tok.norm)) continue;
    if (seen.has(tok.stem)) continue;
    seen.add(tok.stem);
    out.terms.push(tok.norm);
  }
  return out;
}
