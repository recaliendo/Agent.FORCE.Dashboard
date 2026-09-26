/**
 * The records-search contract between the Electron main process and the
 * renderer. Type-only and dependency-free so both tsconfigs can import it.
 *
 * `OfwSearchPayload` mirrors ofw-mcp's `ofw_search_messages` response, so the
 * panel renders a connector answer and a locally-ranked answer identically.
 */

export type OfwSearchMode = 'natural' | 'all' | 'exact';
export type OfwFolder = 'inbox' | 'sent' | 'both';

export interface OfwSearchRequest {
  query: string;
  mode?: OfwSearchMode;
  folderId?: OfwFolder;
  since?: string;
  until?: string;
  limit?: number;
  /** Sync the cache first when it cannot vouch for an empty answer. */
  autoRefresh?: boolean;
}

export interface OfwMatch {
  query: string;
  matchedAs: string[];
  via: 'exact' | 'related' | 'spelling';
}

export interface OfwSource {
  messageId: number;
  folder: string;
  subject: string;
  from: string | null;
  to: string[];
  sentAt: string;
  sentAtDisplay?: string;
  replyToId?: number | null;
  chainRootId?: number | null;
}

export interface OfwSearchHit {
  rank: number;
  score: number;
  source: OfwSource;
  /** Original text with matches wrapped in «». */
  snippet: string;
  matched: OfwMatch[];
  phrasesMatched?: string[];
  matchedIn: Array<'subject' | 'body'>;
  bodySource?: 'preview' | 'none';
}

export interface OfwInterpretation {
  query: string;
  mode: OfwSearchMode;
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

export interface OfwFreshness {
  source?: string;
  asOf?: string;
  asOfDisplay?: string;
  staleness?: string;
  historyComplete?: boolean;
  warning?: string;
  [key: string]: unknown;
}

export interface OfwSearchPayload {
  complete: boolean;
  returned?: number;
  totalMatches?: number;
  searched?: number;
  completeNote?: string;
  bodiesNote?: string;
  note?: string;
  autoRefreshed?: boolean;
  interpretation?: OfwInterpretation;
  freshness?: OfwFreshness;
  results?: OfwSearchHit[];
  /** Present on a refusal (e.g. UNVERIFIED_EMPTY): the search did not produce an answer. */
  result?: string;
  reason?: string;
  remedy?: string;
}

export type OfwSearchResponse =
  | {
      ok: true;
      /** "connector": ofw_search_messages ranked it. "local": the dashboard ranked the connector's messages. */
      engine: 'connector' | 'local';
      retrievedAt: string;
      /** True when the connector refused (payload.result is set) — a non-answer, never an empty result. */
      refused: boolean;
      payload: OfwSearchPayload;
    }
  | { ok: false; error: string; setupHint?: string };

export interface OfwStatus {
  configured: boolean;
  command: string;
  running: boolean;
  tools: string[];
  naturalLanguage: boolean;
  error?: string;
}
