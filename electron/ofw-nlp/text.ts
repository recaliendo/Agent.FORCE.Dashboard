// Vendored from caliendohomes-rgb/RCOFWMCP src/search/ (ofw_search_messages) — see ./row.ts.
/**
 * Text normalisation for natural-language search: tokenising with source
 * offsets, a Porter stemmer, stopwords, and the co-parenting vocabulary that
 * lets "pickup" find a message that only ever says "exchange".
 *
 * Deliberately dependency-free and deterministic. The search runs over a
 * legal record, so the same query against the same cache must always return
 * the same ranking — no model call, no network, no sampling.
 */

/** A word as it appears in the source, with where it appears. */
export interface Token {
  /** Lowercased surface form ("drop-off" arrives here already merged as "dropoff"). */
  norm: string;
  stem: string;
  /** Character offsets into the ORIGINAL text, so a snippet can highlight it in place. */
  start: number;
  end: number;
}

// ── Porter stemmer (M.F. Porter, 1980) ──

function isCons(w: string, i: number): boolean {
  const c = w[i];
  if (c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u') return false;
  if (c === 'y') return i === 0 ? true : !isCons(w, i - 1);
  return true;
}

/** Porter's m: the number of vowel→consonant sequences in `s`. */
function measure(s: string): number {
  let n = 0;
  let i = 0;
  const len = s.length;
  while (i < len && isCons(s, i)) i++;
  while (i < len) {
    while (i < len && !isCons(s, i)) i++;
    if (i >= len) break;
    n++;
    while (i < len && isCons(s, i)) i++;
  }
  return n;
}

function hasVowel(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (!isCons(s, i)) return true;
  return false;
}

function endsDoubleCons(s: string): boolean {
  const l = s.length;
  return l >= 2 && s[l - 1] === s[l - 2] && isCons(s, l - 1);
}

/** Consonant-vowel-consonant ending, where the last consonant is not w, x or y. */
function endsCvc(s: string): boolean {
  const l = s.length;
  if (l < 3) return false;
  const last = s[l - 1];
  return isCons(s, l - 3) && !isCons(s, l - 2) && isCons(s, l - 1) && last !== 'w' && last !== 'x' && last !== 'y';
}

type Rule = [suffix: string, replacement: string];

const STEP2: Rule[] = [
  ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'], ['izer', 'ize'],
  ['bli', 'ble'], ['alli', 'al'], ['entli', 'ent'], ['eli', 'e'], ['ousli', 'ous'],
  ['ization', 'ize'], ['ation', 'ate'], ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'],
  ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
  ['logi', 'log'],
];
const STEP3: Rule[] = [
  ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', ''],
];
const STEP4 = [
  'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment', 'ent', 'ion', 'ou',
  'ism', 'ate', 'iti', 'ous', 'ive', 'ize',
];

// Longest suffix first: Porter matches the longest suffix present and, if its
// condition fails, does NOT fall back to a shorter one.
const byLengthDesc = <T extends string | Rule>(xs: T[]): T[] =>
  [...xs].sort((a, b) => (typeof b === 'string' ? b : b[0]).length - (typeof a === 'string' ? a : a[0]).length);
const STEP2_SORTED = byLengthDesc(STEP2);
const STEP3_SORTED = byLengthDesc(STEP3);
const STEP4_SORTED = byLengthDesc(STEP4);

function applyRules(w: string, rules: Rule[]): string {
  for (const [suffix, rep] of rules) {
    if (w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length);
      return measure(stem) > 0 ? stem + rep : w;
    }
  }
  return w;
}

export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 2 || !/^[a-z]+$/.test(w)) return w;

  // Step 1a
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (w.endsWith('ss')) { /* keep */ } else if (w.endsWith('s')) w = w.slice(0, -1);

  // Step 1b
  let step1bTail = false;
  if (w.endsWith('eed')) {
    if (measure(w.slice(0, -3)) > 0) w = w.slice(0, -1);
  } else if (w.endsWith('ed') && hasVowel(w.slice(0, -2))) {
    w = w.slice(0, -2);
    step1bTail = true;
  } else if (w.endsWith('ing') && hasVowel(w.slice(0, -3))) {
    w = w.slice(0, -3);
    step1bTail = true;
  }
  if (step1bTail) {
    if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
    else if (endsDoubleCons(w) && !/[lsz]$/.test(w)) w = w.slice(0, -1);
    else if (measure(w) === 1 && endsCvc(w)) w += 'e';
  }

  // Step 1c
  if (w.endsWith('y') && hasVowel(w.slice(0, -1))) w = w.slice(0, -1) + 'i';

  w = applyRules(w, STEP2_SORTED);
  w = applyRules(w, STEP3_SORTED);

  // Step 4
  for (const suffix of STEP4_SORTED) {
    if (w.endsWith(suffix)) {
      const s = w.slice(0, -suffix.length);
      if (measure(s) > 1 && (suffix !== 'ion' || /[st]$/.test(s))) w = s;
      break;
    }
  }

  // Step 5a
  if (w.endsWith('e')) {
    const s = w.slice(0, -1);
    const m = measure(s);
    if (m > 1 || (m === 1 && !endsCvc(s))) w = s;
  }
  // Step 5b
  if (measure(w) > 1 && endsDoubleCons(w) && w.endsWith('l')) w = w.slice(0, -1);

  return w;
}

// ── Vocabulary ──

/**
 * Words that carry no topic. Includes the "search filler" people type around
 * a question ("find messages where she talked about…") — every one of those
 * words is in nearly every message, so leaving them in would rank by chatter.
 */
export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if',
  'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor',
  'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out',
  'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves', 'also',
  'ever', 'get', 'got', 'let', 'lets', 'like', 'please', 'really', 'still', 'thing', 'things', 'way',
  // Search filler.
  'find', 'show', 'search', 'look', 'looking', 'list', 'give', 'pull', 'bring', 'see', 'tell', 'told',
  'telling', 'say', 'said', 'says', 'saying', 'write', 'wrote', 'written', 'writing', 'send', 'sent',
  'mention', 'mentioned', 'mentions', 'mentioning', 'talk', 'talked', 'talks', 'talking', 'discuss',
  'discussed', 'discussing', 'discussion', 'regarding', 'regards', 're', 'concerning', 'related',
  'message', 'messages', 'msg', 'msgs', 'email', 'emails', 'thread', 'threads', 'conversation',
  'conversations', 'ofw', 'ourfamilywizard', 'record', 'records', 'everything', 'anything', 'something',
  'refer', 'referring', 'referred', 'reference', 'references', 'ex', 'may', 'might', 'must', 'shall',
]);

/** Shorthand people type, mapped to the word the record would use. */
const ABBREVIATIONS: Record<string, string> = {
  appt: 'appointment', appts: 'appointments', dr: 'doctor', drs: 'doctors', doc: 'doctor',
  bday: 'birthday', xmas: 'christmas', thx: 'thanks', ty: 'thanks', hw: 'homework', meds: 'medication',
  med: 'medication', rx: 'prescription', tmrw: 'tomorrow', tmr: 'tomorrow', tonite: 'tonight',
  wknd: 'weekend', wkend: 'weekend', sched: 'schedule', vacay: 'vacation', ins: 'insurance',
  info: 'information', b4: 'before', pls: 'please', plz: 'please', reimb: 'reimbursement',
  mom: 'mother', mommy: 'mother', dad: 'father', daddy: 'father',
  // Irregular forms the stemmer cannot reach: "paid" must find "pay".
  paid: 'pay', bought: 'buy', spent: 'spend', brought: 'bring', took: 'take', taken: 'take',
  gave: 'give', given: 'give', went: 'go', gone: 'go', left: 'leave', kept: 'keep', forgot: 'forget',
  forgotten: 'forget', children: 'child', kids: 'kid', teeth: 'tooth', caught: 'catch', drove: 'drive',
  driven: 'drive', ate: 'eat', ran: 'run', slept: 'sleep', woke: 'wake', lost: 'lose', met: 'meet',
  paying: 'pay', pays: 'pay',
};

/**
 * Two-word forms merged into one token before stemming, applied to messages
 * AND queries alike so "drop off", "drop-off" and "dropoff" are one word.
 */
const COMPOUNDS: Record<string, string> = {
  'drop off': 'dropoff', 'pick up': 'pickup', 'hand off': 'handoff', 'make up': 'makeup',
  'child support': 'childsupport', 'report card': 'reportcard', 'parenting time': 'parentingtime',
  'time share': 'timeshare', 'urgent care': 'urgentcare', 'face time': 'facetime', 'day care': 'daycare',
  'after care': 'aftercare', 'baby sitter': 'babysitter', 'summer camp': 'summercamp', 'birth day': 'birthday',
  'co parent': 'coparent', 'co parenting': 'coparenting', 'home work': 'homework', 'spring break': 'springbreak',
  'winter break': 'winterbreak', 'mothers day': 'mothersday', 'fathers day': 'fathersday',
  'running late': 'late',
};

/**
 * Concept groups for query expansion. A query word in a group also matches
 * the group's other words, at a discount (see SYNONYM_WEIGHT in rank.ts), so
 * an exact hit still outranks a related one.
 */
const CONCEPTS: string[][] = [
  ['pickup', 'dropoff', 'exchange', 'handoff', 'custody', 'visitation', 'parentingtime', 'timeshare', 'transfer'],
  ['school', 'class', 'teacher', 'homework', 'reportcard', 'grade', 'grades', 'principal', 'classroom', 'tutor', 'tutoring', 'pta'],
  ['conference', 'meeting'],
  ['doctor', 'pediatrician', 'dentist', 'orthodontist', 'medical', 'clinic', 'hospital', 'urgentcare', 'physician', 'health'],
  ['appointment', 'checkup', 'visit', 'consultation'],
  ['medication', 'medicine', 'prescription', 'pharmacy', 'dose', 'antibiotic', 'antibiotics'],
  ['therapy', 'therapist', 'counselor', 'counseling', 'psychologist', 'psychiatrist'],
  ['sick', 'ill', 'illness', 'fever', 'flu', 'covid', 'cold', 'vomiting', 'throwing', 'cough', 'symptoms'],
  ['money', 'pay', 'payment', 'paid', 'reimburse', 'reimbursement', 'expense', 'expenses', 'cost', 'bill', 'invoice', 'owe', 'owed', 'refund', 'childsupport', 'venmo', 'zelle', 'split', 'receipt', 'copay'],
  ['holiday', 'holidays', 'christmas', 'thanksgiving', 'easter', 'halloween', 'hanukkah', 'passover', 'springbreak', 'winterbreak', 'mothersday', 'fathersday', 'new year'],
  ['vacation', 'trip', 'travel', 'traveling', 'flight', 'passport', 'cruise', 'itinerary', 'out of town'],
  ['birthday', 'party', 'celebration'],
  ['schedule', 'calendar', 'swap', 'switch', 'trade', 'reschedule', 'makeup', 'change', 'rearrange'],
  ['late', 'tardy', 'delay', 'delayed', 'wait', 'waiting', 'waited'],
  ['cancel', 'cancelled', 'canceled', 'cancellation', 'called off'],
  ['phone', 'call', 'calls', 'facetime', 'video', 'text', 'texts', 'texting', 'zoom'],
  ['insurance', 'coverage', 'deductible', 'copay', 'premium', 'claim'],
  ['camp', 'summercamp', 'daycare', 'babysitter', 'childcare', 'nanny', 'sitter', 'aftercare', 'preschool'],
  ['sport', 'sports', 'practice', 'game', 'soccer', 'baseball', 'basketball', 'football', 'dance', 'lesson', 'lessons', 'recital', 'tournament', 'swim', 'swimming', 'gymnastics', 'hockey', 'lacrosse', 'tennis'],
  ['lawyer', 'attorney', 'court', 'judge', 'mediator', 'mediation', 'hearing', 'motion', 'guardian', 'gal', 'custody order', 'agreement', 'decree'],
  ['clothes', 'clothing', 'shoes', 'jacket', 'coat', 'uniform', 'outfit'],
  ['car', 'drive', 'driving', 'ride', 'transport', 'transportation', 'carpool'],
  ['mother', 'mom'],
  ['father', 'dad'],
  ['weekend', 'saturday', 'sunday'],
];

const conceptIndex = new Map<string, Set<string>>();
for (const group of CONCEPTS) {
  const stems = group.filter((w) => !w.includes(' ')).map(stem);
  for (const s of stems) {
    const set = conceptIndex.get(s) ?? new Set<string>();
    for (const other of stems) if (other !== s) set.add(other);
    conceptIndex.set(s, set);
  }
}

/** The stems related to `s` by the concept groups (never includes `s` itself). */
export function relatedStems(s: string): string[] {
  return [...(conceptIndex.get(s) ?? [])];
}

/** Canonical form of one lowercased word: expand shorthand. */
function canonical(word: string): string {
  return ABBREVIATIONS[word] ?? word;
}

/**
 * Split text into word tokens that remember where they came from.
 *
 * Hyphenated and two-word compounds collapse to one token spanning both
 * words, and possessive "'s" is dropped ("Emma's" → "emma").
 */
export function tokenize(text: string): Token[] {
  const raw: Array<{ word: string; start: number; end: number }> = [];
  const re = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    let word = m[0].toLowerCase().replace(/’/g, "'");
    if (word.endsWith("'s")) word = word.slice(0, -2);
    else word = word.replace(/'/g, '');
    raw.push({ word: canonical(word), start: m.index, end: m.index + m[0].length });
  }
  const out: Token[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    const next = raw[i + 1];
    // Only merge words separated by whitespace or a single hyphen — never
    // across a sentence break ("drop. Off we go").
    if (next !== undefined && /^[\s-]{1,3}$/.test(text.slice(cur.end, next.start))) {
      const merged = COMPOUNDS[`${cur.word} ${next.word}`];
      if (merged !== undefined) {
        out.push({ norm: merged, stem: stem(merged), start: cur.start, end: next.end });
        i++;
        continue;
      }
    }
    out.push({ norm: cur.word, stem: stem(cur.word), start: cur.start, end: cur.end });
  }
  return out;
}

/**
 * Damerau–Levenshtein (optimal string alignment) distance, abandoned early
 * once it must exceed `max` — the caller only asks "within 1 or 2 edits?".
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}
