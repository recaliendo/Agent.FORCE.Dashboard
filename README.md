# Agent FORCE Dashboard

Agent FORCE Dashboard is a desktop launch station for many agent projects: Codex builds, Claude Code builds, hybrid workflows, local scripts, and manual operating playbooks.

The app opens on **Choose your agent project.** Richard Job Search Agent is only one sample project; the architecture supports a fleet of project cockpits.

The visual system is an original galactic command-center interface with graphite panels, blue holographic borders, green readiness accents, telemetry, mentor guidance, connector posture, and daily reports. It does not use licensed franchise logos, characters, imagery, quotes, or protected assets.

## Core UX

1. Project Launch Bay: choose the agent project to operate.
2. Project Cockpit: use a sticky project command header, Next Best Action, and workflow tabs for Overview, Agents, Connectors, Daily Report, Council, Launch Actions, and Activity.
3. Connector Hub: project-scoped non-secret references for GitHub, Supabase, Netlify, Stripe, and custom systems.
4. Agent FORCE Council: run reusable QA, engineering, marketing, product, and executive review agents against any project scope.
5. Daily Report Center: generate, copy, save, and view recent project-scoped daily reports with latest Council signals.
6. Agent FORCE Chat: persistent project-scoped chat through the configured local OpenAI-compatible Qwen endpoint.
7. Mentor Guidance: deterministic local guidance from Master Verdant for Ricky Skywalker, including Council risk context.
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

## 3D Character System

Agent FORCE now includes original humanized pseudo-3D character agents built with React, inline SVG, and CSS, without downloaded models, official imagery, protected likenesses, logos, weapons, ships, quotes, or franchise art.

Characters created:

- Princess Leia: QA Signal Commander for QA findings, readiness warnings, severity triage, and retest flow.
- Luke Skywalker: Systems Repair Engineer for engineering repair plans, build/test repair posture, and Codex repair prompts.
- ChewMacka: Brand Signal Amplifier for marketing, SEO, readability, navigation clarity, and color-system integrity.
- Han Solo: Product Navigator for customer need, product direction, next best action, and roadmap priority.
- CEO: Executive Command Authority for release readiness, executive decision, approval, and conditions.
- Master Verdant: Strategic Mentor Hologram for guidance, warnings, and next-step discovery.

Where they appear:

- Launch Bay: Master Verdant appears in the Mentor Guidance panel without overpowering project selection.
- Project Cockpit Overview: the active advisor changes based on the strongest project signal, such as QA risk, engineering repair, product clarity, connector risk, or approval state.
- Council tab: the Council Chamber shows the five review roles with state, finding count, repair count, latest output, workflow progress, role details, and action buttons.
- Council tab: selected operators open a role dossier with active state, owned findings, assigned repairs, surfaces owned, latest output, and direct action.
- Findings panel: each finding shows the owning character next to the finding context.
- Daily Report: Advisor Signal shows the active character, reason, and next action in a compact report-safe format.

States and interactions:

- Supported states are idle, scanning, repairing, reviewing, warning, blocked, approved, and completed.
- Character action buttons navigate to the correct cockpit surface: QA findings, Codex prompt, executive decision, launch actions, connector hub, daily report, or mentor overview.
- Council character cards are keyboard focusable, clickable for role details, and include separate action buttons.
- Advisor cards include owner and next-move readouts so the character art reinforces orientation instead of replacing workflow text.

Performance and accessibility:

- The system uses lightweight inline SVG figures, CSS hologram layering, and CSS 3D transforms, not WebGL or large model assets.
- The latest polish pass adds studio-style SVG gradients, rim lighting, facial expression states, face highlights, eye glints, uniform belts/badges, star-map backdrops, cinematic panel spotlights, and selected-operator Council dossiers.
- Decorative visual layers are hidden from assistive technology while role, state, reason, and actions remain readable text.
- State is never color-only; each character has a text status badge.
- `prefers-reduced-motion` disables character orbit, scan, glow, pulse, and hover lift animations.
- The non-WebGL CSS implementation is the fallback path by design.

## Agent FORCE Council

The Council is a deterministic local review system that produces structured findings, executive direction, Markdown reports, and copyable Codex repair prompts.

Council agent builds:

- Princess Leia: QA Software Agent Optimizer for defects, release risk, accessibility, connector posture, localStorage safety, launch actions, and retest instructions.
- Luke Skywalker: Expert Level Software Engineer for TypeScript, React, Electron safety, localStorage, build, and repair planning.
- ChewMacka: Marketing Executive Agent for SEO, readability, brand clarity, navigation, conversion copy, and executive trust.
- Han Solo: Chief Product Officer for customer need, product direction, workflow value, prioritization, and speed-to-value.
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
LLM_AUTOSTART=true
LLAMA_GPU_LAYERS=12
LLAMA_CONTEXT_SIZE=8192
```

Run `npm run qwen:start` only when you want to keep the model server running independently of the dashboard. Set `LLM_AUTOSTART=false` for an externally managed local server, or change `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL_NAME` to use any hosted OpenAI-compatible provider without code changes.

With the server running, `npm run qwen:verify` checks authenticated health, coherent completion, and incremental token streaming.

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

It rebuilds the desktop bundle before opening Electron so stale build output does not create a blank window.

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
- Confirm Master Verdant appears in Launch Bay mentor guidance and Ask Mentor still opens guidance.
- Confirm Overview Advisor Signal changes based on Council risk, repair plans, product gaps, connector gaps, and approval state.
- Confirm Council Chamber character cards are clickable, keyboard focusable, and their action buttons open the expected panel.
- Confirm findings show the correct owning character.
- Confirm Daily Report Advisor Signal opens the expected cockpit tab.
- Confirm reduced motion disables character orbit, scan, glow, pulse, and hover lift animations.
