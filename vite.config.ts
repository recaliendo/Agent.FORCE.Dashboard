import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
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

export default defineConfig({
  base: './',
  plugins: [react()],
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
