// Qwen doctor: diagnose the local model with real measurements.
//
//   pnpm qwen:doctor            report on the running server
//   pnpm qwen:doctor -- --start start the managed llama-server first (and stop it after)
//   pnpm qwen:doctor -- --quick skip the speed measurements
//   pnpm qwen:doctor -- --json  machine-readable output
//
// The report never prints passwords or keys, so it is safe to paste.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { applyDotEnv, getQwenConfig, toClientConfig } from '../dist-electron/electron/qwenConfig.js';
import { ensureManagedLocalLlm, getManagedLocalLlmState, stopManagedLocalLlm } from '../dist-electron/electron/localLlmRuntime.js';
import { formatDoctorReport, runQwenDoctor } from '../dist-electron/electron/qwenDoctor.js';

const args = new Set(process.argv.slice(2));
const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) applyDotEnv(readFileSync(envPath, 'utf8'));
else console.log(`No .env in ${process.cwd()} — using defaults. (Run this from the dashboard folder.)`);

function git(cmd) {
  try { return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}
const commit = git('rev-parse --short HEAD');
const build = [commit && (git('status --porcelain') ? `${commit} (with local edits)` : commit), git('rev-parse --abbrev-ref HEAD')].filter(Boolean).join(' on ');

const config = getQwenConfig();
const runtime = getManagedLocalLlmState(config.baseUrl);
let started = false;
try {
  if (args.has('--start') && runtime.autostart) {
    console.log('Starting the managed llama-server (this takes ~20–30 s)…');
    await ensureManagedLocalLlm(config);
    started = true;
  }
} catch (error) {
  console.log(`Could not start the managed server: ${error instanceof Error ? error.message : error}`);
}

if (!args.has('--json')) console.log(args.has('--quick') ? 'Running quick checks…\n' : 'Running checks — the speed measurements take up to a minute…\n');
const report = await runQwenDoctor({ client: toClientConfig(config), runtime, quick: args.has('--quick') });
console.log(args.has('--json') ? JSON.stringify(report, null, 2) : formatDoctorReport(report, build || undefined));
if (started) stopManagedLocalLlm();
process.exitCode = report.verdict === 'fail' ? 1 : 0;
