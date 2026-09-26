/**
 * The message shape the search engine ranks — the subset of ofw-mcp's cached
 * `MessageRow` it reads. The engine files beside this one are a vendored copy
 * of ofw-mcp's `src/search/` (caliendohomes-rgb/RCOFWMCP), so a connector
 * without `ofw_search_messages` can still be searched in natural language.
 * Keep them in step with that repo.
 */
export interface Recipient {
  userId: number;
  name: string;
  viewedAt: string | null;
}

export interface MessageRow {
  id: number;
  folder: string;
  subject: string;
  fromUser: string;
  sentAt: string;
  recipients: Recipient[];
  body: string | null;
  fetchedBodyAt: string | null;
  replyToId: number | null;
  chainRootId: number | null;
  listData: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Who sent it: the row's own sender, else the list payload's `author`. */
export function senderOf(row: MessageRow): string | null {
  if (typeof row.fromUser === 'string' && row.fromUser !== '') return row.fromUser;
  const name = asRecord(asRecord(row.listData)?.author)?.name;
  return typeof name === 'string' && name !== '' ? name : null;
}

/** Attachment count, or undefined when OFW reported none either way. */
export function fileCountOf(row: MessageRow): number | undefined {
  const files = asRecord(row.listData)?.files;
  if (typeof files === 'number') return files;
  if (Array.isArray(files)) return files.length;
  return undefined;
}
