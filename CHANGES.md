# Reconciliation Changes

## Fleet and source grounding

- Removed the retired cockpit from the active registry, routes, reports, prompts, tests,
  fixtures, and project-adjacent documentation. Its previous deep link now resolves to a
  local not-found screen.
- Removed the illustrated character layer and replaced Council presentation with neutral
  functional roles. The deleted files remain recoverable from Git history; fully purging
  those historical blobs would require a coordinated history rewrite.
- Registered the target four-project fleet: TalentQuest, Halo Portfolio Agent,
  StandardCraft, and DivorceAgent.
- Retained the three existing persistence IDs for Halo, StandardCraft, and DivorceAgent so
  project-scoped localStorage data remains addressable. TalentQuest received a new stable ID.
- Grounded TalentQuest at source commit `55e753ead434fee03feedb1b6b55a1ff230be7fa`.
  Source evidence and explicit unknowns are recorded in `TALENTQUEST_SOURCING.md`.
- Initially kept StandardCraft metadata-only; the final source-backed connector reconciliation
  below supersedes that initial registry posture.
- Added the exact Halo repository as an outbound navigation target. Its neutral product
  label is used for visible text, title, ARIA label, and tooltip; the target is omitted from
  exported renderer configuration.

## Readiness and interface

- Added pure collectors for connectors, agents, Council, deployment, reports, and activity.
  Readiness actions now carry evidence keys and are ranked without waiting for inference.
- Replaced hardcoded telemetry and seeded next actions with derived readiness state.
- Removed duplicate primary actions and the redundant right context rail. One deterministic
  action card remains, with a stable reserved slot for optional Qwen rationale.
- Rebuilt the visual layer on centralized surface, text, semantic, spacing, radius,
  typography, focus, and motion tokens. Gradients and glow effects were removed.
- Added reusable Button, Card, StatTile, Badge, StatusDot, ListRow, EmptyState, Tabs, and
  ActionCard primitives.
- Kept the AI Command Interface directly below the project header. The transcript uses page
  scrolling, while workflow tabs stay one-row and horizontally scroll at compact widths.
- Added an incremental safe Markdown renderer for streamed headings, lists, emphasis,
  inline code, and fenced code. It parses newly completed lines instead of reparsing the
  entire response for each token.

## Guardrails and evidence

- Added a source-aware content lint. The sole narrow vocabulary exclusion is the Halo
  `repository.url` property; moving that value or rendering it causes the check to fail.
- Added automated tests for restricted surfaces, retired routes, readiness provenance,
  sub-50 ms readiness evaluation, hostile SSE chunk boundaries, and incremental Markdown.
- Captured before/after screenshots for Launch Bay and all eight cockpit tabs at 1440 px and
  1024 px in `artifacts/screenshots`.

## Security observations

- The user-supplied brief flags the public Halo repository as potentially containing
  personal information. The repository contents were deliberately not read. Any future
  connector must apply an explicit content filter and data-minimization policy before data
  reaches the renderer or a model prompt.
- The TalentQuest source checkout contains a tracked `.env` file with three assignments.
  Values were not opened or printed. Repository owners should determine whether history
  remediation and credential rotation are required.
- Deleted character artwork remains in existing Git history. Removing it from all historical
  refs is a separate destructive repository operation and was not performed.

## Phase gate

- The typed mentor intent gateway requires changing the preload API and widening the IPC
  bridge from raw chat messages to an intent/payload request contract. The brief classifies
  that as `ESCALATE`, so no such interface change has been made without explicit approval.

## Final infrastructure reconciliation

- Re-audited the fleet against current authenticated GitHub repository state and recorded
  commit-level evidence in `REPOSITORY_INFRASTRUCTURE_AUDIT.md`.
- Expanded StandardCraft from metadata-only to an evidence-qualified infrastructure map:
  GitHub, Netlify, Supabase, Stripe, SMTP, GitHub Actions, the StandardCraft Ops MCP, and the
  provider-neutral analytics plan.
- Added source-backed TalentQuest connectors for GitHub, Supabase, and Lovable Cloud auth.
- Kept unverified services out of the `connected` state. Only reachable GitHub repositories
  and the live Netlify production endpoint are marked connected.
- Preserved Halo as navigation-only and DivorceAgent repository status as `UNKNOWN`; no
  sensitive repository content or ambiguous repository association was imported.
- Cataloged all eleven repositories exposed by the authenticated owner. Empty, unrelated,
  and separate prototype repositories remain outside the four-project fleet by design.
- Added connector descriptions and surfaced `connected`, `needs_setup`, and `unknown` as
  separate counts in the StandardCraft Connector Hub.
- Expanded assistant responses to the full transcript width while retaining narrower,
  right-aligned user prompts. Added a layout contract test to prevent regression.
- Added three Mermaid source/SVG/PNG architecture views for CTO review: AI infrastructure,
  Agent FORCE and agent infrastructure, and user and operations.

## Command-center UX pass

Audit evidence: before/after captures at 1440, 1024, 768 and 390 px; interaction checks
recorded in the pull request.

- **Start on Projects.** `/` now opens the project list instead of silently opening the
  first project while the address said home.
- **Orientation.** The top bar carries a breadcrumb (Projects / project) inside a project,
  an actionable "N of M projects need attention" link that opens the filtered list, and a
  "Commands gated" note that explains the shell-command opt-in. Side rail: "All projects"
  and "Projects" replace "Launch Bay" and "Project Fleet".
- **Projects page.** Page header, a fleet summary whose counts are also filters
  (need attention, high risk, missing connectors, open Council findings, no daily report),
  a toolbar with search, five primary filters and a "More filters" menu (all eleven
  filters kept), and a project table: status as text, readiness and risk right-aligned,
  connectors, Council result, next action. The table scrolls horizontally on narrow
  screens rather than dropping columns.
- **Records tab.** The OurFamilyWizard workspace moved from above the cockpit tabs (where
  it preceded every tab) into a Records tab, enabled per project by `recordsWorkspace`.
- **Overview by importance.** Next action, then attention items beside a Project health
  panel (readiness, risk, automation and coverage with tones; every connector with its
  status as text; one-click inventory links), then product clarity and guidance.
- **Removed fabricated displays.** The per-project "Mission signal" chart plotted six
  points invented from one snapshot, and the "Mission Map" was a decorative fake map;
  both are gone (FOLLOW_UPS #13). The four HUD widgets that repeated the header are
  replaced by Project health.
- **Shared patterns.** `src/statusTone.ts` is the single status vocabulary (project,
  connector, score, risk → tone + text label). One segmented-control style serves
  in-page view switches (project filters, OFW record types and search mode, Council
  views), deliberately unlike the bordered cockpit tabs that navigate between areas.
- **Fixes.** Tab switches no longer fire a toast; in-page links bring the tab bar into
  view and keep the active tab visible. The tab panel has `role="tabpanel"` labelled by
  its tab. Cockpit tabs stay on one row and scroll instead of wrapping. A min-content grid
  track let Council content push the page 215 px past a phone screen; fixed.

## Qwen diagnosis and repair

Evidence: measured against a real llama.cpp server (build b1-4df29be) running a small test
model on CPU in the development container, not on the RTX 4060 laptop. The behaviour is the
server's; the absolute speeds are not the laptop's.

- **Errors are named, not all "Server unavailable".** Every unrecognised failure used to be
  reported as the server being down. Errors now carry a code. The chat and Records panels
  say what actually happened: key rejected, request too large, model still loading, busy,
  runtime failed to start, server error, server silent, or not reachable.
- **Queued requests are no longer killed.** llama.cpp sends response headers only when its
  single slot starts a request. The 10 s "connect" timeout therefore cancelled any request
  waiting behind another one; in the measurement, a queued request started at 32.4 s. The
  wait is now `LLM_QUEUE_TIMEOUT_SECONDS` (default 180 s), and the chat shows "Waiting"
  with the reason.
- **Long prompts are no longer cut off while being read.** The 30 s limit counted only
  visible answer text, so requests were cancelled while the model was still reading. The
  old logic cancelled a 6,200-token prompt at 30.1 s; the new client completed it.
  Requests now ask for `return_progress`, and any bytes count as activity, including
  progress frames and the server's 30 s keep-alive. The silence limit defaults to 120 s
  and is never below 90 s.
- **Requests fit the context window.** The app reads the server's context size from
  `/props` and fits each request to it. It drops the oldest conversation turns first, then
  shortens the longest message in the middle, and tells the user what was left out. Records
  analyses size their excerpt budget to the context as well. Oversized requests used to
  fail with HTTP 400, which was shown as "Server unavailable".
- **The prompt cache works across questions.** OFW excerpts used to sit in the system
  prompt, so each question changed the prompt's opening and forced a full re-read. They
  now go in the final user message after a stable system prompt, with `cache_prompt` on.
  A repeated prompt dropped from 15 s to 62 ms on the test server.
- **Visible progress.** While Qwen reads, the answer shows "Reading X of Y tokens · Z
  reused from cache". Finished answers show reading and writing speed. Answers cut off at
  the length limit say so and suggest asking "continue".
- **Health check with real measurements.** `pnpm qwen:doctor` and the chat panel's Health
  button check:
  - the endpoint, the runtime files, reachability and the key;
  - the context size, and whether another request is holding the slot.

  They also measure first-word time, reading and writing speed, and cache reuse. They
  recognise common runtime-log failures: GPU out of memory, a model that fails to load, a
  port already in use, context overflow, and a rejected key. Reports redact keys and
  tokens.
- **Build stamp.** The top bar shows the commit the running app was built from, so an
  outdated build is visible at a glance.
- Tests: `tests/qwen-client.test.mjs` covers streaming, progress and keep-alive,
  inactivity, queueing, truncation, error mapping, cancellation, context fitting, config
  migration, and the doctor, using a scripted fake llama.cpp server.

## Backend hardening for QA handoff

A staff-level audit of the Electron main process, the OFW connector connection, the
managed llama-server runtime and the streaming client. Each defect below was reproduced
or reasoned from the code, fixed, and covered by `tests/backend-hardening.test.mjs`.
Two tests were checked against the unfixed code: the stderr-flood test hung without the
fix, and the slot-release test failed without it.

- **OFW connector could freeze.** Its stderr was piped but never read. About 64 KB of
  connector warnings filled the pipe and blocked every later OurFamilyWizard request.
  stderr is now drained into a bounded, redacted tail, which is also used to explain
  connection failures.
- **Connection errors hid their cause.** A failed connector start always said "check the
  paths". It now includes the connector's last message (redacted), and a write-tool
  refusal keeps its own reason.
- **Model secrets leaked to the connector.** `LLM_*` and `LLAMA_*` variables are no
  longer passed to the connector process. Read-only flags are always forced.
- **The llama-server key was on the command line** when the key file was missing, where
  any local process could read it. It is now passed through `LLAMA_API_KEY`.
- **Startup failed while the model was loading.** A server already on the port that
  answered 503 made startup throw. It is now waited for.
- **Local-address checks disagreed.** Autostart didn't treat `[::1]` or other `127.x`
  addresses as local, while the privacy guard did. There is now one shared check.
- **A failed stream held the model's only slot.** After a bad frame or error frame, the
  request stayed open and llama.cpp kept generating. The request is now closed.
- **Stop was ignored during record retrieval.** Cancellation is now registered from the
  start of an analysis. A window that closes mid-answer also aborts its requests.
- **IPC trust boundary.**
  - Every handler accepts calls only from the app's own page.
  - Inputs are type-checked and bounded.
  - A refused request now reaches the UI as an error instead of leaving it waiting.
  - The unused non-streaming chat channel was removed.
- **Privacy.**
  - Chat content that carries OFW excerpts is refused for non-local models in the main
    process too, not only by the renderer. The chat shows it as "Blocked for privacy".
  - Redaction now covers named passwords, secrets and tokens.
- **Window.** Navigation away from the app and `window.open` are denied. External links
  open in the system browser. The production build has a Content-Security-Policy.
- **Chat grounding.**
  - If records can't be retrieved, the model is told they're unavailable instead of
    being asked to cite excerpts it never received.
  - A double Send during record lookup no longer starts two turns.
  - A lookup that finishes after a project switch is dropped.
- **Timeline order** now compares actual times, not timestamp strings with different UTC
  offsets.
- **`qwen:start`.**
  - Stops overwriting PowerShell's `$args`.
  - Adds defaults for unset settings.
  - Quotes paths that contain spaces.
  - Passes the key file only when it exists.
- **Health check.** It now reads whichever server log is newest, including the one
  `qwen:start` writes.
- **Setup message.** The "not configured" message now points to the guide that exists.

Validation:
- `pnpm test`, 62 tests.
- Typecheck, build and content lint.
- A 14-check end-to-end pass in the real Electron app, using a stand-in OFW connector
  and a stand-in model server:
  - CSP and IPC trust;
  - chat;
  - refused and malformed requests;
  - navigation and window guards;
  - search and cited answers;
  - Stop during retrieval and during generation, including slot release;
  - double Send;
  - no CSP violations and no console errors.

Not validated here: Windows, PowerShell, and the real model on the target laptop.
