import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Which code is running? Stamped at build time so the UI can show it — the
 * answer to "I updated but nothing changed" is usually "that window was
 * built from another branch or folder".
 */
function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

const appBuild = {
  commit: git('rev-parse --short HEAD') || 'unknown',
  branch: git('rev-parse --abbrev-ref HEAD') || 'unknown',
  dirty: git('status --porcelain --untracked-files=no') !== '',
  builtAt: new Date().toISOString()
};

/**
 * Production Content-Security-Policy. The packaged app loads only its own
 * bundle and talks to the main process over IPC, so nothing else — remote
 * scripts, frames, network calls — is needed. Not applied to the dev server,
 * whose hot reload relies on inline scripts and a websocket.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'"
].join('; ');

const productionCsp: Plugin = {
  name: 'agent-force-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
};

export default defineConfig({
  base: './',
  plugins: [react(), productionCsp],
  define: {
    __APP_BUILD__: JSON.stringify(appBuild)
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
