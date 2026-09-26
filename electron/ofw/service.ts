import { McpStdioClient, type McpServerSpec } from './mcp-client.js';
import type {
  OfwFreshness, OfwInterpretation, OfwSearchHit, OfwSearchPayload, OfwSearchRequest, OfwSearchResponse, OfwStatus
} from './contract.js';
import { parseQuery, type ParsedQuery } from './search/query.js';
import { rankMessages } from './search/rank.js';
import { senderOf, type MessageRow, type Recipient } from './search/row.js';

/**
 * Records search for the dashboard.
 *
 * Preferred path: the connector's own `ofw_search_messages` (ofw-mcp with
 * natural-language search — caliendohomes-rgb/RCOFWMCP). If the connector is
 * an older build without it, the dashboard pages through
 * `ofw_list_messages` and ranks the messages itself with the same engine, so a
 * question never degrades into an exact-substring search.
 */

const PAGE_SIZE = 200;
const MAX_PAGES = 100;
const DEFAULT_TZ = 'America/New_York';

export function resolveServerSpec(env: NodeJS.ProcessEnv): { spec: McpServerSpec; configured: boolean } {
  const passEnv = { ...env };
  const command = env.OFW_MCP_COMMAND?.trim();
  if (command) {
    return { spec: { command, args: parseArgs(env.OFW_MCP_ARGS), env: passEnv }, configured: true };
  }
  const entry = env.OFW_MCP_ENTRY?.trim();
  if (entry) {
    // A local build of RCOFWMCP: `node <repo>/dist/index.js`.
    return { spec: { command: 'node', args: [entry], env: passEnv }, configured: true };
  }
  // Nothing configured: the published package. It may predate
  // ofw_search_messages; the local ranking fallback covers that.
  return { spec: { command: 'npx', args: ['-y', 'ofw-mcp'], env: passEnv }, configured: false };
}

/** OFW_MCP_ARGS as a JSON array (paths with spaces), else whitespace-separated. */
function parseArgs(raw: string | undefined): string[] {
  const value = raw?.trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fall through to whitespace split */
    }
  }
  return value.split(/\s+/);
}

const SETUP_HINT =
  'Set OFW_MCP_ENTRY to your RCOFWMCP build (…/RCOFWMCP/dist/index.js) or OFW_MCP_COMMAND/OFW_MCP_ARGS, plus OFW_USERNAME and OFW_PASSWORD, then restart the dashboard. See README → "OurFamilyWizard records search".';

export class OfwRecordsService {
  private readonly client: McpStdioClient;
  private readonly configured: boolean;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const { spec, configured } = resolveServerSpec(env);
    this.client = new McpStdioClient(spec);
    this.configured = configured;
  }

  async status(): Promise<OfwStatus> {
    try {
      const tools = await this.client.listTools();
      return {
        configured: this.configured,
        command: this.client.describe(),
        running: true,
        tools,
        naturalLanguage: tools.includes('ofw_search_messages')
      };
    } catch (error) {
      return {
        configured: this.configured,
        command: this.client.describe(),
        running: false,
        tools: [],
        naturalLanguage: false,
        error: (error as Error).message
      };
    }
  }

  async search(request: OfwSearchRequest): Promise<OfwSearchResponse> {
    const query = request.query.trim();
    if (!query) return { ok: false, error: 'Type what you are looking for.' };
    try {
      const tools = await this.client.listTools();
      if (tools.includes('ofw_search_messages')) return await this.viaConnector(request);
      if (tools.includes('ofw_list_messages')) return await this.viaLocalRanking(request);
      return { ok: false, error: 'The connector answered, but it is not an OurFamilyWizard connector (no message tools).', setupHint: SETUP_HINT };
    } catch (error) {
      return { ok: false, error: (error as Error).message, setupHint: SETUP_HINT };
    }
  }

  stop(): void {
    this.client.stop();
  }

  private async viaConnector(request: OfwSearchRequest): Promise<OfwSearchResponse> {
    const args: Record<string, unknown> = { query: request.query, mode: request.mode ?? 'natural', limit: request.limit ?? 25 };
    if (request.folderId) args.folderId = request.folderId;
    if (request.since) args.since = request.since;
    if (request.until) args.until = request.until;
    if (request.autoRefresh !== undefined) args.autoRefresh = request.autoRefresh;
    const result = await this.client.callTool('ofw_search_messages', args);
    const payload = parsePayload(result.text);
    return { ok: true, engine: 'connector', retrievedAt: new Date().toISOString(), refused: result.isError || payload.result !== undefined, payload };
  }

  private async viaLocalRanking(request: OfwSearchRequest): Promise<OfwSearchResponse> {
    const mode = request.mode ?? 'natural';
    const tz = process.env.DISPLAY_TZ?.trim() || DEFAULT_TZ;
    const parsed: ParsedQuery = mode === 'exact'
      ? { raw: request.query, terms: [], phrases: [request.query.trim()], excluded: [], dateExpressions: [], people: [] }
      : parseQuery(request.query, new Date(), tz);
    if (request.since) parsed.since = request.since;
    if (request.until) parsed.until = request.until;
    if (request.folderId) {
      parsed.folder = request.folderId === 'both' ? undefined : request.folderId;
      parsed.folderReason = parsed.folder ? 'folder selector' : undefined;
    }

    // Let the connector do the cheap narrowing (folder, dates, and — in exact
    // mode — the literal substring); rank what comes back here.
    const listArgs: Record<string, unknown> = {
      folderId: parsed.folder ?? 'both',
      size: PAGE_SIZE,
      view: 'compact'
    };
    if (parsed.since) listArgs.since = parsed.since;
    if (parsed.until) listArgs.until = parsed.until;
    if (mode === 'exact') listArgs.q = request.query.trim();
    if (request.autoRefresh !== undefined) listArgs.autoRefresh = request.autoRefresh;

    const rows: MessageRow[] = [];
    let freshness: OfwFreshness | undefined;
    let fetchedAll = false;
    let autoRefreshed = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await this.client.callTool('ofw_list_messages', { ...listArgs, page });
      const data = parsePayload(result.text) as OfwSearchPayload & { messages?: CompactMessage[]; nextPage?: number | null };
      if (result.isError || data.result !== undefined) {
        // A refusal (e.g. UNVERIFIED_EMPTY) is passed through as a non-answer.
        return {
          ok: true, engine: 'local', retrievedAt: new Date().toISOString(), refused: true,
          payload: { ...data, complete: false, interpretation: interpretationOf(parsed, mode, request.query) }
        };
      }
      freshness = data.freshness;
      autoRefreshed ||= data.autoRefreshed === true;
      rows.push(...(data.messages ?? []).map(toRow));
      if (data.nextPage === null || data.nextPage === undefined) {
        fetchedAll = true;
        break;
      }
    }

    const ranked = rankMessages(rows, parsed, mode);
    const limit = request.limit ?? 25;
    const top = ranked.hits.slice(0, limit);
    const totalMatches = ranked.hits.length;
    const fresh = freshness?.staleness === 'fresh' && freshness.historyComplete === true;
    const complete = fetchedAll && fresh && top.length === totalMatches;

    const payload: OfwSearchPayload = {
      complete,
      returned: top.length,
      totalMatches,
      searched: rows.length
    };
    if (!complete) {
      payload.completeNote = [
        top.length < totalMatches ? `showing the top ${top.length} of ${totalMatches} matches` : null,
        !fetchedAll ? `only the first ${rows.length} messages in range were searched` : null,
        freshness?.staleness !== 'fresh' ? `the cache is "${freshness?.staleness ?? 'unknown'}", so newer messages may exist on OurFamilyWizard` : null,
        freshness?.historyComplete === false ? 'older history is still being backfilled' : null
      ].filter((r): r is string => r !== null).join('; ').concat('. Do not state a total or an absence from this result without resolving that first.');
    }
    if (ranked.bodiesMissing > 0) {
      payload.bodiesNote = `${ranked.bodiesMissing} of the ${rows.length} searched messages have no cached body (never opened), so only their subject was searched.`;
    }
    if (totalMatches === 0) {
      payload.note = fresh
        ? 'Nothing matched, and the cache is verified-fresh — a real "nothing matched" for the question as interpreted. Check how it was read; relax dates or folder, drop a word, or try Exact words.'
        : 'Nothing matched in the cached messages, but the cache is not verified-fresh — this is NOT proof of absence. Sync and search again.';
    }
    if (autoRefreshed) payload.autoRefreshed = true;
    payload.interpretation = { ...interpretationOf(parsed, mode, request.query), ...ranked.interpretation, query: request.query };
    payload.freshness = freshness;
    payload.results = top.map((h, i): OfwSearchHit => {
      const compact = h.row as MessageRow & { sentAtDisplay?: string };
      return {
        rank: i + 1,
        score: h.score,
        source: {
          messageId: h.row.id,
          folder: h.row.folder,
          subject: h.row.subject,
          from: senderOf(h.row),
          to: h.row.recipients.map((r) => r.name),
          sentAt: h.row.sentAt,
          sentAtDisplay: compact.sentAtDisplay,
          replyToId: h.row.replyToId,
          chainRootId: h.row.chainRootId
        },
        snippet: h.snippet,
        matched: h.matched,
        ...(h.phrasesMatched.length > 0 ? { phrasesMatched: h.phrasesMatched } : {}),
        matchedIn: h.matchedIn,
        ...(h.bodySource !== 'body' ? { bodySource: h.bodySource } : {})
      };
    });
    return { ok: true, engine: 'local', retrievedAt: new Date().toISOString(), refused: false, payload };
  }
}

/** ofw_list_messages' compact row. */
interface CompactMessage {
  id: number;
  folder: string;
  subject: string;
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

function interpretationOf(parsed: ParsedQuery, mode: OfwInterpretation['mode'], query: string): OfwInterpretation {
  return {
    query,
    mode,
    terms: parsed.terms.map((word) => ({ word })),
    phrases: parsed.phrases,
    excluded: parsed.excluded,
    since: parsed.since,
    until: parsed.until,
    dateExpressions: parsed.dateExpressions,
    folder: parsed.folder,
    folderReason: parsed.folderReason,
    hasAttachments: parsed.hasAttachments,
    notes: []
  };
}

function parsePayload(text: string): OfwSearchPayload {
  try {
    return JSON.parse(text) as OfwSearchPayload;
  } catch {
    // A plain-text tool error (e.g. a login failure) — surface it as a refusal.
    return { complete: false, result: 'CONNECTOR_ERROR', reason: text || 'The connector returned an empty response.' };
  }
}
