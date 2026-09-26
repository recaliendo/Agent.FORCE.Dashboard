import { parseQuery, type ParsedQuery } from './query.js';
import { rankMessages, type SearchMode } from './rank.js';
import { senderOf, type MessageRow, type Recipient } from './row.js';

/**
 * Natural-language search over OFW messages, for a connector that predates
 * `ofw_search_messages`. Pages through the read-only `ofw_list_messages`
 * (folder/date narrowing happens in the connector) and ranks locally with the
 * same engine, returning the same payload shape `ofw_search_messages` does, so
 * the panel and the grounding code never need to know which path answered.
 */

export type CallTool = (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;

export interface NaturalSearchArgs {
  query: string;
  mode?: SearchMode;
  folderId?: 'inbox' | 'sent' | 'both';
  since?: string;
  until?: string;
  limit?: number;
  includeBody?: boolean;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 60;
const DEFAULT_TZ = 'America/New_York';

interface CompactMessage {
  id: number;
  folder: string;
  subject?: string;
  from?: string | null;
  sentAt: string;
  sentAtDisplay?: string;
  recipients?: Recipient[];
  files?: number;
  body?: string | null;
  fetchedBodyAt?: string | null;
  replyToId?: number | null;
  chainRootId?: number | null;
}

function toRow(m: CompactMessage): MessageRow & { sentAtDisplay?: string } {
  return {
    id: m.id,
    folder: m.folder,
    subject: m.subject ?? '',
    fromUser: m.from ?? '',
    sentAt: m.sentAt,
    sentAtDisplay: m.sentAtDisplay,
    recipients: m.recipients ?? [],
    body: m.body ?? null,
    fetchedBodyAt: m.fetchedBodyAt ?? null,
    replyToId: m.replyToId ?? null,
    chainRootId: m.chainRootId ?? null,
    listData: { author: { name: m.from ?? '' }, ...(m.files !== undefined ? { files: m.files } : {}) }
  };
}

export async function localNaturalSearch(callTool: CallTool, args: NaturalSearchArgs, now = new Date()): Promise<Record<string, unknown>> {
  const mode: SearchMode = args.mode ?? 'natural';
  const tz = process.env.DISPLAY_TZ?.trim() || DEFAULT_TZ;
  const parsed: ParsedQuery = mode === 'exact'
    ? { raw: args.query, terms: [], phrases: args.query.trim() ? [args.query.trim()] : [], excluded: [], dateExpressions: [], people: [] }
    : parseQuery(args.query, now, tz);
  if (args.since) parsed.since = args.since;
  if (args.until) parsed.until = args.until;
  if (args.folderId) {
    parsed.folder = args.folderId === 'both' ? undefined : args.folderId;
    parsed.folderReason = parsed.folder ? 'folder selector' : undefined;
  }

  const listArgs: Record<string, unknown> = { folderId: parsed.folder ?? 'both', size: PAGE_SIZE, view: 'compact', autoRefresh: true };
  if (parsed.since) listArgs.since = parsed.since;
  if (parsed.until) listArgs.until = parsed.until;
  if (mode === 'exact' && args.query.trim()) listArgs.q = args.query.trim();

  const rows: Array<MessageRow & { sentAtDisplay?: string }> = [];
  let freshness: Record<string, unknown> | undefined;
  let fetchedAll = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await callTool('ofw_list_messages', { ...listArgs, page });
    if (typeof data.result === 'string') {
      // A refusal (e.g. UNVERIFIED_EMPTY) is a non-answer; pass it through untouched.
      return { ...data, complete: false, engine: 'local' };
    }
    freshness = data.freshness as Record<string, unknown> | undefined;
    rows.push(...((data.messages as CompactMessage[] | undefined) ?? []).map(toRow));
    if (data.nextPage === null || data.nextPage === undefined) {
      fetchedAll = true;
      break;
    }
  }

  const ranked = rankMessages(rows, parsed, mode);
  const limit = args.limit ?? 25;
  const top = ranked.hits.slice(0, limit);
  const fresh = freshness?.staleness === 'fresh' && freshness.historyComplete === true;
  const complete = fetchedAll && fresh && top.length === ranked.hits.length;

  const payload: Record<string, unknown> = {
    complete,
    returned: top.length,
    totalMatches: ranked.hits.length,
    searched: rows.length,
    engine: 'local'
  };
  if (!complete) {
    payload.completeNote = [
      top.length < ranked.hits.length ? `showing the top ${top.length} of ${ranked.hits.length} matches` : null,
      !fetchedAll ? `only the first ${rows.length} messages in range were searched` : null,
      freshness?.staleness !== 'fresh' ? `the cache is "${String(freshness?.staleness ?? 'unknown')}", so newer messages may exist on OurFamilyWizard` : null,
      freshness?.historyComplete === false ? 'older history is still being backfilled' : null
    ].filter((r): r is string => r !== null).join('; ').concat('. Do not state a total or an absence from this result without resolving that first.');
  }
  if (ranked.bodiesMissing > 0) {
    payload.bodiesNote = `${ranked.bodiesMissing} of the ${rows.length} searched messages have no cached body (unread bodies are never fetched), so only their subject was searched.`;
  }
  if (ranked.hits.length === 0) {
    payload.note = fresh
      ? 'Nothing matched, and the cache is verified-fresh — a real "nothing matched" for the question as interpreted.'
      : 'Nothing matched in the cached messages, but the cache is not verified-fresh — this is NOT proof of absence. Sync and search again.';
  }
  payload.interpretation = {
    query: args.query,
    ...ranked.interpretation,
    phrases: parsed.phrases,
    dateExpressions: parsed.dateExpressions
  };
  payload.freshness = freshness;
  payload.results = top.map((h, i) => {
    const row = h.row as MessageRow & { sentAtDisplay?: string };
    return {
      rank: i + 1,
      score: h.score,
      source: {
        messageId: row.id,
        folder: row.folder,
        subject: row.subject,
        from: senderOf(row),
        to: row.recipients.map((r) => r.name),
        sentAt: row.sentAt,
        sentAtDisplay: row.sentAtDisplay,
        replyToId: row.replyToId,
        chainRootId: row.chainRootId
      },
      snippet: h.snippet,
      matched: h.matched,
      ...(h.phrasesMatched.length > 0 ? { phrasesMatched: h.phrasesMatched } : {}),
      matchedIn: h.matchedIn,
      ...(h.bodySource !== 'body' ? { bodySource: h.bodySource } : {}),
      ...(args.includeBody && row.body != null ? { body: row.body } : {})
    };
  });
  return payload;
}
