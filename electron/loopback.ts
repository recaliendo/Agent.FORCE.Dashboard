/**
 * True when a URL points at this computer: localhost, ::1 (bracketed or not),
 * or any 127.0.0.0/8 address. The single definition used both for "may the app
 * start the local llama-server here" and "may OFW records be sent here", so the
 * two decisions can never disagree.
 */
export function isLoopbackBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}
