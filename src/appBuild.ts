/** The running build, as stamped by vite.config.ts. */
export const APP_BUILD = typeof __APP_BUILD__ === 'object' && __APP_BUILD__
  ? __APP_BUILD__
  : { commit: 'unknown', branch: 'unknown', dirty: false, builtAt: '' };

/** "a1b2c3d on main, built 26 Sep 2026 16:40" — for the UI and pasted reports. */
export function describeBuild(): string {
  const when = APP_BUILD.builtAt ? new Date(APP_BUILD.builtAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'unknown time';
  return `${APP_BUILD.commit}${APP_BUILD.dirty ? ' (with local edits)' : ''} on ${APP_BUILD.branch}, built ${when}`;
}
