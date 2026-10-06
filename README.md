# Agent FORCE Dashboard

Agent FORCE Dashboard is a desktop launch station for many agent projects: Codex builds, Claude Code builds, hybrid workflows, local scripts, and manual operating playbooks.

The app opens on **Choose your agent project.** The architecture supports a fleet of independent project cockpits.

The visual system is an original galactic command-center interface with graphite panels, blue holographic borders, green readiness accents, telemetry, mentor guidance, connector posture, and daily reports. It does not use licensed franchise logos, characters, imagery, quotes, or protected assets.

## Core UX

1. Project Launch Bay: choose the agent project to operate.
2. Project Cockpit: use a sticky project command header, Next Best Action, and workflow tabs for Overview, Agents, Connectors, Daily Report, Council, Launch Actions, and Activity.
3. Connector Hub: project-scoped non-secret references for GitHub, Supabase, Netlify, Stripe, and custom systems.
4. Agent FORCE Council: run reusable QA, engineering, marketing, product, and executive review agents against any project scope.
5. Daily Report Center: generate, copy, save, and view recent project-scoped daily reports with latest Council signals.
6. Agent FORCE Chat: persistent project-scoped chat through the configured local OpenAI-compatible Qwen endpoint.
7. Mentor Guidance: deterministic local guidance with Council risk context.
8. Launch Console: open safe URLs, reveal local paths, and keep commands gated.

## Product Flow

The cockpit is organized as an application workspace rather than one long page.

- Persistent project header: project name, callsign, status, readiness, connector health, top risk, latest Council decision, and primary action.
- Overview tab: mission brief, product clarity, customer need, success criteria, blockers, mentor guidance, attention items, latest report/Council posture, and recent operating signals.
- Agents tab: project-specific agent cards, status, launch/review actions, Open Agent, Open Folder, Open Docs, Open Repo, staged QA/report actions, and configuration drawers.
- Connectors tab: connector cards, persisted Check Now status, Configure Connector, Copy Reference, safe Open Connector, and missing reference states.
- Daily Report tab: generate, copy, save, view current report, and open recent project-scoped reports.
- Council tab: run/retest Council, view findings, view CEO decision, export Council report, generate/copy Codex repair prompt.
- Agent FORCE Chat: the primary generative interface sits directly below the project command header and remains active while workflow tabs change.
- Launch Actions tab: project and agent launch actions with safe command-gate messaging and configuration drawer.
- Activity tab: mission console, recent reports, Council runs, persisted connector checks, launch-action activity links, and bounded project activity history.
- Settings tab: project metadata, safety notes, local paths, repo references, staged editing guidance, and JSON export.

Every major action provides feedback through inline status, toast notifications, a generated output, navigation, a safe launch result, or a staged configuration panel.

## Immersive UX/UI System

The interface uses performance-safe CSS depth rather than heavy 3D dependencies.

- Layered starfield, horizon grid, scanlines, and soft orbital gradients create spatial orientation without external assets.
- Project cards use 3D-inspired hover/focus depth, priority rails, readable telemetry, Council/report summaries, and a stronger Enter Cockpit CTA.
- Cockpit tabs behave like command controls with active depth states and data-backed attention badges.
- Agent cards read as operational units with hover/focus depth and clear action clusters.
- Connector cards read as infrastructure nodes with status rails, source/reason/next-step metadata, and accessible color plus text labels.
- Daily Report and Council panels use executive-dashboard depth, readable report sections, severity badges, and copy/export feedback.
- Drawers and modals layer above the cockpit with spatial shadowing while preserving keyboard focus and readable status context.
- Reduced motion is respected through `prefers-reduced-motion`, and high-motion tilt/slide effects are disabled for users who prefer less motion.

## Agent FORCE Council

The Council is a deterministic local review system that produces structured findings, executive direction, Markdown reports, and copyable Codex repair prompts.

Council roles:

- QA Optimizer for defects, release risk, accessibility, connector posture, localStorage safety, launch actions, and retest instructions.
- Software Engineer for TypeScript, React, Electron safety, localStorage, build, and repair planning.
- Marketing Executive for SEO, readability, brand clarity, navigation, conversion copy, and executive trust.
- Product Lead for customer need, product direction, workflow value, prioritization, and speed-to-value.
- CEO: final release decision-maker using abstract executive lenses, not real-person impersonation.

The Council can target:

- whole project
- specific project agent
- connector hub
- daily report center
- launch actions
- UX/UI
- marketing/SEO/brand

Council runs are saved in project-scoped localStorage under `agent-force-council-runs:{projectId}`. The Project Launch Bay shows latest CEO decision, readiness score, open Critical findings, and open High findings. Daily reports include the latest Council decision and top QA, engineering, product, and marketing signals when available.

The generated Codex repair prompt is designed for real implementation work outside the running app. The dashboard does not claim code was changed unless Codex or a developer actually changes the source files.

## Safety

- No secrets, tokens, API keys, passwords, Stripe secret keys, Supabase service-role keys, Netlify tokens, or GitHub tokens are stored.
- Connector metadata is reference-only.
- Electron uses `contextIsolation: true` and `nodeIntegration: false`.
- URL launching only allows `http`, `https`, and `mailto`.
- Local path reveal checks for missing paths and fails gracefully.
- Shell commands are disabled unless `AGENT_FORCE_ALLOW_COMMANDS=true`.
- Council reviews use local deterministic rules only. Qwen Chat is optional and calls only the configured OpenAI-compatible endpoint.
- Qwen bearer tokens are read by the Electron main process from environment variables or `.env`; they are not exposed to the renderer.
- Council data stores findings, reports, and prompts only. It must not store secrets or credentials.
- Connector health and activity history are project-scoped and bounded.
- Council display names are internal user-defined labels. The app uses no official franchise images, logos, quotes, voices, or protected likenesses.
- Executive lens cards are abstract strategic review frameworks and do not impersonate public figures.

## Local setup

```bash
npm install
npm run typecheck
npm run build
npm run electron:dev
```

## Qwen Chat Setup

Install the managed Windows llama.cpp runtime and the Qwen GGUF once:

```powershell
npm run qwen:setup
```

This downloads the CUDA runtime and `Qwen3.6-35B-A3B-UD-Q4_K_M.gguf` under `%LOCALAPPDATA%\AgentFORCE`, generates a local API key without printing it, and writes the ignored `.env`. Model weights and secrets remain outside Git. The Electron app starts and stops its own local server automatically.

The generated configuration uses:

```text
LLM_BASE_URL=http://127.0.0.1:8080/v1
LLM_MODEL_NAME=Qwen/Qwen3.6-35B-A3B
LLM_API_KEY=
LLM_TIMEOUT_SECONDS=5
LLM_MAX_OUTPUT_TOKENS=512
LLM_AUTOSTART=true
LLAMA_GPU_LAYERS=all
LLAMA_CPU_MOE_LAYERS=32
LLAMA_LOAD_MODE=none
LLAMA_SPEC_TYPE=none
LLAMA_CONTEXT_SIZE=8192
```

The default local profile is tuned for an 8 GB RTX 4060 Laptop GPU: attention and
shared tensors remain on the GPU, the first 32 sparse expert layers remain in system
RAM, and eager loading removes the long first-prompt paging penalty. Model startup is
slower than memory mapping, but measured chat latency is substantially lower and more
consistent once the endpoint reports ready.

Run `npm run qwen:start` only when you want to keep the model server running independently of the dashboard. Set `LLM_AUTOSTART=false` for an externally managed local server, or change `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL_NAME` to use any hosted OpenAI-compatible provider without code changes.

With the server running, `npm run qwen:verify` checks authenticated health, coherent completion, and incremental token streaming.

### When Qwen is slow, silent, or showing errors

Run the doctor from the dashboard folder and paste its output when asking for help. The
report redacts keys and tokens.

```powershell
pnpm qwen:doctor              # check the server that is already running
pnpm qwen:doctor -- --start   # start the managed server first, then stop it afterwards
pnpm qwen:doctor -- --quick   # skip the speed and cache measurements
pnpm qwen:doctor -- --json    # machine-readable report
```

The **Health** button in the Qwen chat panel runs the same checks and has **Copy report**.
It checks:

- that the endpoint is on this computer;
- that the runtime files exist;
- that the server answers and accepts the key;
- that the context window is at least 8,192 tokens;
- whether another request is holding the model's single slot.

It then measures time to first word, prompt-reading and writing speed, and whether the
prompt cache is reused. It also scans the runtime log for known failures: GPU out of
memory, a model that fails to load, a port already in use, context overflow, and a
rejected API key.

| `.env` setting | Default | Meaning |
| --- | --- | --- |
| `LLM_QUEUE_TIMEOUT_SECONDS` | 180 | How long a request may wait for the model's single slot, because it is busy with another request or still loading, before giving up. llama.cpp sends nothing until the slot starts a request. The legacy `LLM_INFERENCE_CONNECT_TIMEOUT_SECONDS` is used only when it is larger. |
| `LLM_INFERENCE_INACTIVITY_TIMEOUT_SECONDS` | 120 (minimum 90) | How long the stream may be completely silent. Prompt-reading progress and the server's 30-second keep-alive count as activity, so a long prompt is not cut off while it is being read. |
| `LLM_MAX_OUTPUT_TOKENS` | 512 | The answer length limit. A cut-off answer is labelled; ask "continue" for the rest. The Records tab's Summarize, Build timeline, and Commitments & requests analyses use at least 768. |

The top bar shows **Build** and a commit ID. Hover over it for the branch, whether the
folder has local edits, and when the app was built. If the ID doesn't match the latest
commit on `main`, the window is running an older build.

The dashboard does not store chat transcripts; the persistent Agent FORCE Chat surface keeps the conversation in memory for the active project session.

If npm is not on PATH in a local Codex runtime, use the bundled package manager equivalent:

```powershell
$env:PATH="C:\Users\Richa\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;$env:PATH"
& "C:\Users\Richa\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd" install
& "C:\Users\Richa\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd" run typecheck
& "C:\Users\Richa\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd" run build
```

## Desktop shortcut

The local launcher script is:

```text
launch-agent-force-dashboard.cmd
```

It rebuilds the desktop bundle from the folder it lives in, then opens Electron, so stale build
output does not create a blank window. It used to `cd` into a fixed OneDrive path, which meant a
desktop shortcut kept building that folder even after the code was pulled somewhere else.

## Repair a broken install

Simplest fix: double-click `scripts/Fix-AgentFORCE.cmd` (it can be run from anywhere, e.g. a
Downloads copy). It clones a fresh copy of `main` into the usual
`OneDrive\Documents\Agent.FORCE.Dashboard` folder, keeps the old folder as a dated `.old-` backup,
copies `.env` and `ofw.local.json` across, installs, builds, and opens the app, so existing
shortcuts keep working unchanged.

Alternatively:

If the launcher reports a missing file (for example `Cannot find module './OfwPanel'`), the folder
it builds is an out-of-date copy. Clone a fresh copy outside OneDrive and run the repair script:

```powershell
git clone https://github.com/recaliendo/Agent.FORCE.Dashboard "$env:USERPROFILE\AgentFORCE\Agent.FORCE.Dashboard"
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\AgentFORCE\Agent.FORCE.Dashboard\scripts\repair-install.ps1"
```

The script updates the clone to `origin/main`, copies `.env` and `ofw.local.json` from an older copy
it finds (or one passed with `-OldPath`), installs, and builds. It then turns each older copy's
launcher into a forwarder to the new one (keeping the original as `.bak`) and re-points Agent FORCE
shortcuts, including ones that run the launcher through `cmd.exe` or Windows Terminal, before opening
the app. Running it again is safe.

## Command Launch Safety

Commands are blocked by default:

```bash
npm run electron:dev
```

To explicitly allow command launch testing:

```bash
AGENT_FORCE_ALLOW_COMMANDS=true npm run electron:dev
```

Windows PowerShell:

```powershell
$env:AGENT_FORCE_ALLOW_COMMANDS="true"; npm run electron:dev
```

## Registry Model

Project and agent definitions currently live in `src/data/seedProjects.ts`. Each project can define:

- agents
- launch actions
- telemetry
- daily reports
- saved report history
- mentor guidance
- connector references
- next actions
- customer need
- success criteria
- current blockers
- local paths
- repo references
- safety notes

Future persistence can move to encrypted local storage or a user-editable local registry without changing the cockpit model.

Project-scoped localStorage keys:

- `agent-force-daily-reports:{projectId}`
- `agent-force-council-runs:{projectId}`
- `agent-force-connector-health:{projectId}`
- `agent-force-activity:{projectId}`
- `agent-force-project-registry`

Council implementation files:

- `src/council/councilTypes.ts`
- `src/council/councilAgents.ts`
- `src/council/councilEngine.ts`
- `src/council/councilStorage.ts`
- `src/council/codexPromptBuilder.ts`
- `src/components/CouncilCenter.tsx`

## QA checklist

```bash
npm install
npm run typecheck
npm run build
npm run electron:dev
```

Manual QA:

- Open Project Launch Bay and verify search, Clear Search, quick filters, and Refresh Fleet Signals.
- Verify project cards remain readable while hover/focus depth is active.
- Verify tab attention badges are visible and data-backed.
- Verify reduced motion disables tilt/slide effects.
- Verify connector status rails and Council severity badges use text plus color.
- Enter any Project Cockpit and verify the sticky header, Next Best Action, and tabs appear.
- Verify Overview, Agents, Connectors, Daily Report, Council, Launch Actions, and Activity tabs.
- Verify Settings tab, JSON export, safety notes, repo references, and local paths.
- Ask Mentor for Next Step and confirm the recommendation drawer opens.
- Use Configure Connector, Check Now, Copy Reference, and missing URL flows.
- Use Add or Review Launch Actions and confirm the staged safety/configuration drawer opens.
- Use Open Agent, Configure Agent, staged Run QA, and staged Run Report actions.
- Open Project Launch Bay and verify Council readiness appears on project cards.
- Enter any Project Cockpit and verify Agent FORCE Council appears.
- Run Council Review and confirm findings, CEO decision, report, and Codex repair prompt appear.
- Copy the Council Report and Codex Repair Prompt.
- Switch projects and verify Council run history is project-scoped.
- Reload and verify saved Council runs persist.
- Generate a daily report after a Council run and confirm the latest Council signal appears.
- Confirm Mentor Guidance references Council state.
- Confirm no official franchise assets, quotes, logos, or protected likenesses are used.
- Confirm Launch Bay mentor guidance and Ask Mentor still open guidance.
- Confirm findings show the correct functional Council owner.
