# Agent FORCE Dashboard

**Agent FORCE Dashboard** is a desktop launch station for every agent project, workflow, repo, Codex build, Claude Code build, local command, and operating playbook you want to control from one immersive hub.

The app opens on a **Choose Your Agent Project** home screen. Each project is its own command theater with its own agents, launch links, local workspace paths, commands, telemetry, notes, and status. The **Richard Job Search Agent** is included only as the first sample project; the infrastructure is built to support many project agents.

The visual system is a cinematic galactic command-center experience: holographic panels, starfield depth, 3D launch cards, mission-readiness indicators, and cockpit-style project controls. It does **not** use licensed Star Wars logos, imagery, characters, or assets.

## Core UX

1. **Project Launch Bay** — choose the agent project you want to operate.
2. **Project Cockpit** — view that project’s mission, agents, launch actions, workspace links, command queue, and readiness status.
3. **Agent Deck** — manage multiple agents under each project, including Codex, Claude Code, hybrid, local, and manual agents.
4. **Launch Console** — open URLs, reveal local paths, or run approved commands from the desktop app.
5. **Scalable registry model** — seed data is local and typed, with a clean path toward persistence, sync, and project templates.

## Tech stack

- Electron
- React
- TypeScript
- Vite
- CSS-only immersive 3D UI system

## Local setup

```bash
npm install
npm run electron:dev
```

## Production build

```bash
npm run build
npm run desktop:preview
```

To create packaged desktop installers:

```bash
npm run dist
```

## Command launch safety

URL and file/folder launches work by default. Shell command launching is disabled unless you explicitly opt in:

```bash
AGENT_FORCE_ALLOW_COMMANDS=true npm run electron:dev
```

On Windows PowerShell:

```powershell
$env:AGENT_FORCE_ALLOW_COMMANDS="true"; npm run electron:dev
```

## OurFamilyWizard records search

The **Legal Ops Console (EVIDENCE-DECK)** cockpit has a **Search your records** panel backed by the OurFamilyWizard MCP connector ([caliendohomes-rgb/RCOFWMCP](https://github.com/caliendohomes-rgb/RCOFWMCP)). It is natural-language search, not an exact-substring box:

- **Ask a question** (default): *"what did she say about the dentist last month?"* The question is read for dates ("last month", "since March", "between May 1 and June 15"), for who wrote it ("I told her…" → sent, "she said…"/"from my ex" → received, "from Sarah"), for topic words with related wording (pay ↔ reimburse/receipt, pickup ↔ exchange/drop-off), and for typos. Quoted text is matched exactly; `-word` or `NOT word` excludes.
- **All words**: every topic word (or a related form) must appear.
- **Exact words**: the whole text as one literal phrase.

Every result keeps the source in view: message number, sender → recipient, sent date/time, subject, and a passage of the original text with the matches highlighted, plus **Copy citation**. A **Read as** line shows exactly how the question was interpreted, so a narrowing you did not intend is visible; the folder selector overrides it. **Export** saves the request and full response as JSON.

The panel never reports "nothing found" from a cache that OurFamilyWizard has not recently verified. It says the result is unverified and offers **Sync with OurFamilyWizard and search again**.

### Connecting it

The desktop app starts the connector itself (stdio) on the first search and keeps it running. Credentials stay in the Electron main process and never reach the page. Put the settings in a `.env` file in the project root (gitignored) or in your environment:

```bash
# Recommended: your build of RCOFWMCP, which has ofw_search_messages
OFW_MCP_ENTRY=/path/to/RCOFWMCP/dist/index.js
OFW_USERNAME=you@example.com
OFW_PASSWORD=your-password
# Optional: the zone OurFamilyWizard reports times in (default America/New_York)
DISPLAY_TZ=America/New_York
```

Build the connector once: `git clone https://github.com/caliendohomes-rgb/RCOFWMCP && cd RCOFWMCP && npm install && npm run build` (Node 22.5+).

Alternatives: `OFW_MCP_COMMAND` + `OFW_MCP_ARGS` (a JSON array or space-separated) for any launch command. With nothing set, the app runs `npx -y ofw-mcp`. If the connector has no `ofw_search_messages` (older published builds), the dashboard pages through `ofw_list_messages` and ranks the messages itself with the same search engine (`electron/ofw/search/`, vendored from RCOFWMCP), so questions still work. The badge in the panel says which path is in use.

## Registry model

The first version stores project and agent definitions in a typed seed registry. The UI is intentionally structured so the registry can later move to encrypted local persistence, GitHub-backed sync, or a user-editable JSON database.

## Recommended next evolution

1. Add encrypted local persistence for project and agent records.
2. Add project creation/editing directly from the UI.
3. Add automatic agent discovery from selected workspace folders.
4. Add health checks for repo, local path, command availability, and API credentials.
5. Add deep links to Codex, Claude, GitHub PRs, deployment dashboards, logs, and runbooks.
6. Add project templates: Job Search, Portfolio, Website QA, Legal Ops, Product Launch, Research, and Security.
