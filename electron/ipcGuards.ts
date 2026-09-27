/**
 * Input checks for IPC handlers. The renderer is our own code, but IPC is a
 * trust boundary: a compromised or buggy page must not be able to crash the
 * main process, run unbounded work, or route legal records to a remote model.
 * No Electron imports, so these are unit-tested directly.
 */
import { isLoopbackBaseUrl } from './loopback.js';

export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatMessage = { role: ChatRole; content: string };

export const MAX_CHAT_MESSAGES = 64;
export const MAX_CHAT_CHARS = 400_000;

/** Stream ids become IPC channel names; keep them short and plain. */
export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

/** Validate a chat transcript from the renderer, or throw a readable error. */
export function sanitizeChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('A chat request needs at least one message.');
  if (value.length > MAX_CHAT_MESSAGES) throw new Error(`A chat request can carry at most ${MAX_CHAT_MESSAGES} messages.`);
  let total = 0;
  return value.map((item, index) => {
    const role = (item as { role?: unknown } | null)?.role;
    const content = (item as { content?: unknown } | null)?.content;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') throw new Error(`Message ${index + 1} has an invalid role.`);
    if (typeof content !== 'string') throw new Error(`Message ${index + 1} has no text.`);
    total += content.length;
    if (total > MAX_CHAT_CHARS) throw new Error('The chat request is too large.');
    return { role, content };
  });
}

/** Markers the app itself puts around OFW excerpts (chat grounding and analysis). */
const OFW_MARKERS = ['OFW message excerpts retrieved for this question', 'You analyse OurFamilyWizard co-parenting messages'];

export function containsOfwRecords(messages: ChatMessage[]): boolean {
  return messages.some((m) => OFW_MARKERS.some((marker) => m.content.includes(marker)));
}

/** Throws REMOTE_MODEL_BLOCKED unless OFW content may go to this base URL. */
export function assertOfwDestination(baseUrl: string, allowRemote: boolean): void {
  if (allowRemote || isLoopbackBaseUrl(baseUrl)) return;
  let host = baseUrl;
  try { host = new URL(baseUrl).host; } catch { /* keep the raw value */ }
  throw new Error(`REMOTE_MODEL_BLOCKED: OFW records are only sent to a model on this computer, but LLM_BASE_URL points to ${host}. Use the local Qwen server (http://127.0.0.1:8080/v1), or set OFW_ALLOW_REMOTE_LLM=true if you accept sending records to that provider.`);
}

/**
 * IPC is accepted only from the app's own page: the bundled file in
 * production, or the Vite dev server in development.
 */
export function isTrustedSenderUrl(url: string | undefined, appFileUrl: string, devServerUrl?: string): boolean {
  if (!url) return false;
  if (url === appFileUrl || url.startsWith(`${appFileUrl}#`) || url.startsWith(`${appFileUrl}?`)) return true;
  if (devServerUrl) {
    try { return new URL(url).origin === new URL(devServerUrl).origin; } catch { return false; }
  }
  return false;
}

/** Only these schemes may be handed to the operating system. */
export function isSafeExternalUrl(target: unknown): target is string {
  if (typeof target !== 'string' || target.length > 2048) return false;
  try {
    return ['https:', 'http:', 'mailto:'].includes(new URL(target).protocol);
  } catch {
    return false;
  }
}
