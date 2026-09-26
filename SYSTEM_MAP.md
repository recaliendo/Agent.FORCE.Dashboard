# Agent FORCE Dashboard System Map

This is the historical Phase 0 deep-dive captured on 2026-08-12. Its detailed findings are
retained as an audit trail and may not reflect the reconciled fleet or later QA work.

For the current 2026-08-13 executive architecture, use the canonical diagrams in
`artifacts/diagrams/`: AI infrastructure, Agent FORCE and agent infrastructure, and user and
operations. `SYSTEM_MAP.mmd` now mirrors the current AI infrastructure view.

## 1. Executive summary

- The product is a TypeScript, React, Vite, and Electron desktop application. The renderer starts at `src/main.tsx`, the Electron main process starts at `electron/main.ts`, and the isolated preload bridge starts at `electron/preload.ts` (`package.json:6-17`, `index.html:12-14`, `src/main.tsx:1-10`).
- Project, agent, connector, telemetry, and next-action data are compile-time renderer records in `seedProjects`; runtime project editing is not implemented (`src/data/seedProjects.ts:3-415`, `src/App.tsx:1341-1377`).
- Reports, Council runs, connector metadata checks, and activity are deterministic renderer computations persisted in browser `localStorage`; they are not observations from GitHub, Netlify, Supabase, Stripe, a repository, or an MCP server (`src/reportEngine.ts:55-151`, `src/council/councilEngine.ts:534-570`, `src/storage.ts:3-21`, `src/storage.ts:24-38`).
- Qwen is the only live data/inference integration. The renderer can reach it only through preload IPC, while the Electron main process performs OpenAI-compatible HTTP with native `fetch` and can spawn a local `llama-server` child (`src/components/QwenChatPanel.tsx:97-167`, `electron/preload.ts:8-19`, `electron/main.ts:73-119`, `electron/localLlmRuntime.ts:69-122`).
- The current connector model cannot mount `mcp/standardcraft-ops` with zero integration code. It has no MCP client, no adapter lifecycle, no credential handling, and no invocation contract; it only opens references or gated commands (`src/types.ts:26-42`, `src/types.ts:75-89`, `src/App.tsx:1675-1753`, `package.json:20-36`).
- Two credential-boundary violations are present: the renderer receives `LLM_BASE_URL` and local runtime paths, and renderer-controlled command execution can inherit main-process secrets when command mode is enabled (`electron/main.ts:209-218`, `electron/main.ts:221-228`, `src/types.ts:132-144`, `electron/main.ts:18-34`, `electron/main.ts:183-204`). See `DRIFT.md`.

## 2. Build, packaging, and entry points

| Concern | Current implementation | Evidence |
| --- | --- | --- |
| Language | TypeScript for renderer, preload, main, and Vite configuration; JSX uses the React transform. | `tsconfig.json:2-20`, `tsconfig.node.json:2-16` |
| Renderer framework | React mounted with `createRoot`; Vite supplies the renderer build. | `src/main.tsx:1-10`, `vite.config.ts:1-14` |
| Desktop framework | Electron; `package.json.main` points at compiled `dist-electron/electron/main.js`. | `package.json:7`, `package.json:20-31` |
| Package manager | The repository has a pnpm lock/workspace and uses pnpm in the current workspace; scripts remain npm-compatible. | `pnpm-workspace.yaml:1-2`, `package.json:8-18` |
| Browser-only development | `pnpm dev` runs only Vite on strict port 5173. It does not start Electron. | `package.json:9`, `vite.config.ts:7-10` |
| Electron development | `electron:dev` concurrently runs Vite, the Electron TypeScript watcher, waits for both outputs, then starts Electron with `VITE_DEV_SERVER_URL`. | `package.json:15`, `electron/main.ts:10`, `electron/main.ts:144-149` |
| Local production preview | `desktop:preview` compiles renderer and Electron outputs, then runs Electron. | `package.json:16` |
| Build | `build` performs renderer typecheck, Vite build to `dist`, then Electron compile to `dist-electron`. | `package.json:14`, `vite.config.ts:11-14`, `tsconfig.node.json:10-16` |
| Packaging | `electron-builder` produces NSIS, DMG, or AppImage and includes only `dist`, `dist-electron`, and `package.json`. | `package.json:17`, `package.json:38-57` |
| Desktop launcher | The Windows launcher rebuilds all outputs before invoking Electron. | `launch-agent-force-dashboard.cmd:3-13` |
| Automated tests | No test script or test dependency is defined. The available verification is typecheck/build plus the Qwen verification script. | `package.json:8-36` |
| Runtime setup packaging | Setup/start scripts, `.env`, model weights, and llama.cpp binaries are not packaged by `electron-builder`; the managed runtime is expected under `%LOCALAPPDATA%/AgentFORCE`. | `package.json:44-47`, `electron/localLlmRuntime.ts:22-45`, `.gitignore:1-9` |

## 3. Process topology and ownership

| Process | Code that runs there | Responsibilities and credential reach | Evidence |
| --- | --- | --- | --- |
| Electron main | `electron/main.ts`, compiled to `dist-electron/electron/main.js` | Loads `.env`, owns model key/base URL, creates the window, handles IPC, performs HTTP, launches OS actions, and can execute commands. | `package.json:7`, `electron/main.ts:18-47`, `electron/main.ts:122-150`, `electron/main.ts:161-287` |
| Preload isolated world | `electron/preload.ts`, compiled beside main | Exposes the fixed `window.agentForce` API and relays per-request stream events. It does not read environment variables itself. | `electron/main.ts:130-134`, `electron/preload.ts:1-20` |
| Renderer | `index.html` -> `src/main.tsx` -> `src/App.tsx` | Owns React UI state, compile-time project registry, mentor/report/Council rules, localStorage, chat transcripts, and all project-visible models. It must not own service credentials. | `index.html:12-14`, `src/main.tsx:1-10`, `src/App.tsx:35-64`, `src/App.tsx:88-170` |
| Managed llama.cpp child | Spawned by `electron/localLlmRuntime.ts` | Serves the configured model on the host/port parsed from `LLM_BASE_URL`; stdout/stderr append to a local log. | `electron/localLlmRuntime.ts:69-122` |
| Optional command child | Spawned with Node `exec` from Electron main | Executes a renderer-supplied shell command only when `AGENT_FORCE_ALLOW_COMMANDS=true`; inherits default child-process environment and returns stdout/stderr to the renderer. | `electron/main.ts:11`, `electron/main.ts:183-204` |
| Development helper processes | Vite, TypeScript watcher, wait-on, Electron | Exist only in `electron:dev`; they are launched by `concurrently`. | `package.json:15` |
| Standalone setup/start processes | PowerShell plus curl/GitHub/Hugging Face; optional standalone llama-server | Operate outside the desktop process tree when the user runs `qwen:setup` or `qwen:start`. | `package.json:11-13`, `scripts/setup-local-qwen.ps1:18-39`, `scripts/start-local-qwen.ps1:35-45` |

Window security is `contextIsolation: true` and `nodeIntegration: false`, but Chromium sandboxing is explicitly disabled (`electron/main.ts:130-135`). The production renderer loads a local built HTML file; development loads the configured Vite URL and opens DevTools (`electron/main.ts:144-149`).

## 4. IPC surface

All renderer-to-main calls use `ipcRenderer.invoke`; the stream response additionally uses a dynamic main-to-renderer event channel. There are no `ipcRenderer.send` calls (`electron/preload.ts:3-20`).

| Channel | Direction | Request | Response/events | Streaming | Cancellation | Renderer caller | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `agent-force:open-external` | Renderer -> main | `target: string` | `{ok:true}` or `{ok:false,error}` | No | No | Launch actions classified as URLs | `electron/preload.ts:4`, `electron/main.ts:152-168`, `src/App.tsx:207-225` |
| `agent-force:reveal-path` | Renderer -> main | `target: string` | `{ok:true}` or `{ok:false,error}` | No | No | Launch actions classified as paths | `electron/preload.ts:5`, `electron/main.ts:170-181`, `src/App.tsx:207-225` |
| `agent-force:run-command` | Renderer -> main | `command: string` | `{ok:true,output}` or `{ok:false,error}` | No | No; `exec` has a 120-second timeout | Launch actions classified as commands | `electron/preload.ts:6`, `electron/main.ts:183-204`, `src/App.tsx:207-225` |
| `agent-force:get-platform` | Renderer -> main | None | `process.platform: string` | No | No | No current renderer consumer | `electron/preload.ts:7`, `electron/main.ts:207` |
| `agent-force:qwen-config` | Renderer -> main | None | `{ok,baseUrl,modelName,hasApiKey,timeoutMs,runtime}` | No | No | Qwen panel startup | `electron/preload.ts:8`, `electron/main.ts:209-218`, `src/components/QwenChatPanel.tsx:68-83` |
| `agent-force:qwen-health` | Renderer -> main | None | `{ok:true,baseUrl,modelName}` or `{ok:false,error}` | No | No | Qwen Health button | `electron/preload.ts:9`, `electron/main.ts:221-230`, `src/components/QwenChatPanel.tsx:97-106` |
| `agent-force:qwen-chat` | Renderer -> main | `messages: ChatMessage[]` | `{ok:true,content}` or `{ok:false,error}` | No | No | No current renderer consumer | `electron/preload.ts:10`, `electron/main.ts:232-244` |
| `agent-force:qwen-stream-chat` | Renderer -> main | `requestId: string`, `messages: ChatMessage[]` | Invoke resolves `{ok}`; dynamic `agent-force:qwen-stream:${requestId}` emits `{type:'token',token}`, `{type:'done'}`, or `{type:'error',error}` | Yes, SSE -> IPC tokens | No. Renderer cleanup removes only its event listener; it does not abort main HTTP or release the server slot. | Qwen send action | `electron/preload.ts:11-19`, `electron/main.ts:246-287`, `src/components/QwenChatPanel.tsx:117-167` |

### IPC breadth findings

- `getPlatform` and non-streaming `qwenChat` are exposed but unused (`electron/preload.ts:7`, `electron/preload.ts:10`, `src/components/QwenChatPanel.tsx:117-167`).
- `qwenConfig` exposes base URL and absolute server/model/log paths even though the panel needs only model identity plus coarse runtime state (`electron/main.ts:209-218`, `src/components/QwenChatPanel.tsx:70-75`, `src/types.ts:132-144`).
- `runCommand` accepts an arbitrary renderer string rather than an action identifier or allowlisted command. The environment gate is useful but does not narrow authority after it is enabled (`electron/main.ts:183-204`).
- Stream `requestId` and message arrays have TypeScript declarations but no runtime validation, size limit, role validation, or cancellation channel (`src/types.ts:238-252`, `electron/main.ts:246-287`).

## 5. Outbound HTTP and external egress

### Runtime LLM HTTP

| Path | Base/auth | Timeout and retry | Error path | Evidence |
| --- | --- | --- | --- | --- |
| `GET {LLM_BASE_URL}/models` | Base defaults to `http://127.0.0.1:8080/v1`; bearer comes from `LLM_API_KEY`, then `LLAMA_API_KEY`. | `qwenFetch` aborts after configured 5 seconds by default, but `qwenHealth` first awaits managed startup, which may run for 180 seconds. No request retry; managed startup polls every 750 ms. | Raw HTTP response body and base URL are included in thrown errors; health returns that string to renderer. | `electron/main.ts:36-47`, `electron/main.ts:67-104`, `electron/main.ts:221-229`, `electron/localLlmRuntime.ts:125-152` |
| `POST {LLM_BASE_URL}/chat/completions` | Same base and bearer; native Node/Electron `fetch`, not an OpenAI SDK. Body has model, messages, temperature `0.2`, and stream flag. | Same initial 5-second abort. The timer is cleared when response headers arrive, before JSON or streaming body consumption, so body streaming has no end-to-end timeout. No retry. | Non-2xx includes raw response body; errors return to renderer through chat response or stream error event. | `electron/main.ts:57-119`, `electron/main.ts:232-287` |
| Managed readiness probe | Same `/models` endpoint and bearer. | Each probe has a 2-second timeout; startup polls to `LLM_STARTUP_TIMEOUT_SECONDS` (default 180). | Reachable non-ready statuses other than 503 stop startup; missing server/model and child exit include local paths/log path. | `electron/localLlmRuntime.ts:48-67`, `electron/localLlmRuntime.ts:125-152` |

`LLM_BASE_URL` is provider-configurable, and managed autostart is skipped for non-loopback URLs, so the transport is structurally OpenAI-compatible-provider aware (`electron/main.ts:36-47`, `electron/localLlmRuntime.ts:31-34`, `electron/localLlmRuntime.ts:155-162`). Hosted-provider compatibility is not covered by an automated test (`package.json:8-36`). Tool calls are not supported by the app contract: requests contain no `tools`, roles exclude `tool`, and responses read only assistant `content` or streaming `delta.content` (`electron/main.ts:13-16`, `electron/main.ts:107-117`, `electron/main.ts:235-240`, `electron/main.ts:272-276`).

### Other egress

- External URL actions delegate `http`, `https`, or `mailto` targets to the operating system. There is no host allowlist (`electron/main.ts:152-168`).
- The setup script queries the latest llama.cpp GitHub release and the Unsloth Hugging Face tree, then downloads release/model assets. `curl` retries five times but has no maximum duration; the two `Invoke-RestMethod` calls have no explicit timeout or retry (`scripts/setup-local-qwen.ps1:18-39`, `scripts/setup-local-qwen.ps1:72-108`, `scripts/setup-local-qwen.ps1:110-130`).
- The verification script applies 5- or 15-second aborts to its helper requests, but its direct unauthenticated auth probe has no timeout (`scripts/verify-local-qwen.mjs:15-24`, `scripts/verify-local-qwen.mjs:42-65`).
- Renderer project records contain external URLs, but the renderer does not fetch them; they flow through the external-open IPC path (`src/data/seedProjects.ts:25-101`, `src/App.tsx:207-225`).

## 6. Connector model and lifecycle

### What a connector is

`ProjectConnector` is a renderer-visible configuration/reference record: identifier, enum type, label, optional URL/path/command, static status, description, environment, optional last-check text, and optional reason/next-step/data-source text (`src/types.ts:26-42`, `src/types.ts:75-89`). It is not an adapter, credential holder, authenticated client, MCP server registration, or callable tool contract.

### Current lifecycle

1. **Register:** connectors are authored inside each compile-time `AgentProject` entry (`src/data/seedProjects.ts:61-88`, `src/data/seedProjects.ts:279-313`). A localStorage registry API exists but has no application caller (`src/storage.ts:36-38`, `src/storage.ts:70-82`, `src/storage.ts:101-107`, `src/App.tsx:35`).
2. **Authenticate:** absent. Connector metadata is explicitly presented as non-secret/reference-only (`src/App.tsx:1749-1753`).
3. **Health-check:** `Check Now` tests only whether URL/path/command text exists, copies the static connector status, and persists a locally generated reason and next step (`src/App.tsx:684-708`). It performs no connector HTTP or process call.
4. **Invoke:** `Open Connector` converts the reference into a generic URL/path/command launch action (`src/App.tsx:1694-1707`, `src/App.tsx:1735-1744`). There is no typed operation result.
5. **Persist check display:** connector checks are bounded project-scoped localStorage metadata (`src/storage.ts:28-30`, `src/storage.ts:85-90`).

### Implemented versus stubbed

- Implemented: generic external URL opening, path reveal, opt-in command execution, local metadata checks, and renderer persistence (`electron/main.ts:161-204`, `src/App.tsx:684-708`).
- Stubbed: GitHub, Supabase, Netlify, Stripe, and custom connector authentication, live health, API invocation, lifecycle, and credential state. Their enum labels do not have adapters (`src/types.ts:26-38`, `src/App.tsx:1675-1753`).
- StandardCraft MCP feasibility: Electron main is technically capable of spawning a process, but the current dashboard has no MCP client dependency, transport, server registry, tool discovery/invocation, or IPC contract. `standardcraft-ops` therefore cannot mount with zero new integration code (`package.json:20-36`, `electron/main.ts:161-287`, `src/types.ts:26-38`).

### The "2 connectors / 1 setup needed" trace

The command-header value `1 setup needed` is computed from static `needs_setup` or `unknown` statuses (`src/App.tsx:902-908`, `src/App.tsx:1031`). The connectors tab badge can show `2` for the same single unresolved connector because `getCockpitTabBadges` counts it once as `connectorAttention` and again as `uncheckedConnectors`, then adds the two counts (`src/App.tsx:982-1002`). It is an attention badge, not a live connector count. The initial Richard project currently has three connector records, one with `needs_setup` (`src/data/seedProjects.ts:61-88`).

## 7. State, stores, caches, and mutation

| State | Durability | Owner/mutator | Evidence |
| --- | --- | --- | --- |
| Project/agent/connector registry | Source-controlled compile-time data | `seedProjects`; the running app reads but does not mutate it. Settings says editing is staged in source. | `src/data/seedProjects.ts:3-415`, `src/App.tsx:101-102`, `src/App.tsx:1341-1377` |
| App shell/navigation/filter/console | In-memory React state | `App` mutates selected project, search, filter, Council revision, and console lines. | `src/App.tsx:88-170`, `src/App.tsx:172-227` |
| Cockpit working state | In-memory React state, hydrated partly from localStorage on project change | `ProjectCockpit` mutates current report, saved-report view, Council runs, tabs, drawer, toast, connector checks, and activity. | `src/App.tsx:585-609`, `src/App.tsx:621-725` |
| Qwen chat transcript/config/status | In-memory only; reset on project change or unmount | `QwenChatPanel`; no transcript persistence or response cache. | `src/components/QwenChatPanel.tsx:52-95`, `src/components/QwenChatPanel.tsx:108-167` |
| Daily reports | `localStorage`, max 8 per project | Generated by renderer rules and written by `ProjectCockpit`. | `src/App.tsx:559-582`, `src/App.tsx:621-645`, `src/reportEngine.ts:55-151` |
| Council runs | `localStorage`, max 12 per project | Generated synchronously by renderer rules and written by `ProjectCockpit`. | `src/council/councilStorage.ts:4-29`, `src/App.tsx:648-665`, `src/council/councilEngine.ts:534-570` |
| Connector checks | `localStorage`, project-scoped | `ProjectCockpit` writes metadata-only checks. | `src/storage.ts:28-30`, `src/storage.ts:85-90`, `src/App.tsx:684-708` |
| Activity | `localStorage`, max 40 per project | `recordProjectActivity` and `ProjectCockpit` append entries. | `src/storage.ts:32-34`, `src/storage.ts:93-99`, `src/App.tsx:315-330`, `src/App.tsx:616-619` |
| Project registry localStorage API | Durable API exists but is unused | `safeReadRegistry`/`safeWriteRegistry`; no App import or caller. | `src/storage.ts:36-38`, `src/storage.ts:70-82`, `src/storage.ts:101-107`, `src/App.tsx:54-62` |
| Council-center controls | In-memory component state | Scope, target agent, active view, and copy status mutate inside `CouncilCenter`. | `src/components/CouncilCenter.tsx:70-103` |
| Managed runtime state | Main-process module memory plus external files | `managedProcess`, log fd, and startup promise are mutated by runtime start/exit/stop. | `electron/localLlmRuntime.ts:18-20`, `electron/localLlmRuntime.ts:106-121`, `electron/localLlmRuntime.ts:155-178` |
| Secrets/config | Main-process environment and ignored local files | Setup writes `.env` and API-key file; main loads `.env`; runtime reads environment. | `scripts/setup-local-qwen.ps1:134-149`, `electron/main.ts:18-47`, `.gitignore:5-7` |

State coordination uses direct React state and prop callbacks; no shared React Context, reducer, external state library, database, or model-response cache participates in the current runtime paths shown above (`src/App.tsx:88-170`, `src/App.tsx:585-609`, `src/components/QwenChatPanel.tsx:52-66`).

## 8. Data contracts and compatibility

| Contract | Canonical definition/use | Duplication or incompatibility |
| --- | --- | --- |
| Project | `AgentProject` includes metadata, telemetry, tags, connectors, agents, launch actions, and next actions. | `repoUrl`/`repoReferences`/GitHub connector and `localPath`/`localPaths` represent overlapping concepts (`src/types.ts:207-236`). |
| Agent | `AgentDefinition` / alias `AgentUnit`. | Project agents and Council reviewers remain separate role systems; Council reviewers use functional role names and no illustrated persona layer (`src/types.ts`, `src/council/councilTypes.ts`). |
| Connector | `ProjectConnector`; `ConnectorHealthCheck` separately stores a copied status plus local reason text. | Static configuration status and observed health are not separated; the metadata check can repeat static status without live evidence (`src/types.ts:75-89`, `src/types.ts:160-167`, `src/App.tsx:684-708`). |
| Report | `DailyReport` and `DailyReportItem`. | Current reports are deterministic projections of project and Council data, not connector snapshots (`src/types.ts:169-205`, `src/reportEngine.ts:55-151`). |
| Council | `CouncilRun`, `CouncilFinding`, and nested executive decision. | Council output is rule-generated in the renderer while UI labels present expert/QA/engineering decisions; it has no execution or evidence-artifact contract (`src/council/councilTypes.ts:37-96`, `src/council/councilEngine.ts:534-570`). |
| Activity | `ProjectActivity` with type, message, timestamp, and optional detail. | There is no request telemetry shape for model tokens, queue time, first token, duration, truncation, or outcome (`src/types.ts:105-125`). |
| Mentor guidance | `MentorGuideProps.guidance` is a plain string. | No intent, provenance, grounding keys, generation state, cache state, or structured insufficient-context response (`src/App.tsx:348-356`). |
| Next best action | Private `NextBestActionModel` has label/reason/tab/effect and is ranked from the readiness collectors. | A reserved model-rationale slot exists, but generated rationale is not yet connected to the deterministic action contract (`src/App.tsx`, `src/readinessEngine.ts`). |
| Qwen messages | Renderer `QwenChatMessage` and main `ChatMessage`. | Duplicated across process compilation boundaries; both omit `tool` role, tool-call payloads, usage, finish reason, and cancellation (`src/types.ts:127-158`, `electron/main.ts:13-16`). |
| IPC responses | Renderer declarations in `Window.agentForce`; main constructs anonymous object literals. | There is no shared runtime schema or validator at the IPC boundary (`src/types.ts:238-252`, `electron/main.ts:209-287`). |
| Launch action | `LaunchAction` supports multiple aliases for URL/path/command behavior. | Aliases are normalized by a renderer helper rather than a transport-level discriminated contract (`src/types.ts:7-22`, `src/App.tsx:309-312`). |

## 9. Credential and secret paths

1. Setup generates or reuses a key, writes it to ignored `.env` and an external API-key file, and does not print it (`scripts/setup-local-qwen.ps1:41-68`, `scripts/setup-local-qwen.ps1:134-156`, `.gitignore:5-7`).
2. Electron main loads `.env` into `process.env`, then resolves API key from `LLM_API_KEY` or `LLAMA_API_KEY` (`electron/main.ts:18-47`).
3. Main constructs the `Authorization: Bearer` header and performs fetch; the renderer does not construct that header (`electron/main.ts:57-85`).
4. Managed llama-server receives an API-key file when present; if absent, the code falls back to putting the raw key in child-process arguments (`electron/localLlmRuntime.ts:101-104`).
5. Main returns `hasApiKey` but also returns the base URL and absolute runtime paths to renderer (`electron/main.ts:209-218`, `src/types.ts:132-144`). This violates the requested boundary for base URLs.
6. When command mode is enabled, arbitrary renderer commands execute in a child that inherits main-process environment by default; stdout/stderr return to renderer. Since `.env` has already populated `process.env`, a command can read and echo the LLM key (`electron/main.ts:18-34`, `electron/main.ts:183-204`). This is a hard key-reachability violation in enabled-command mode.
7. Provider HTTP response bodies and base URL are embedded in errors sent back to renderer without redaction (`electron/main.ts:88-101`, `electron/main.ts:221-242`, `electron/main.ts:282-285`). A provider that echoes sensitive material can therefore cross the boundary.
8. Connector metadata and exported project JSON live entirely in renderer/localStorage. The UI warns against secrets, but there is no runtime field-level sanitizer (`src/App.tsx:1341-1377`, `src/App.tsx:1438-1448`, `src/storage.ts:15-21`).

## 10. Static data presented as operational signal

The following are the complete classes of current static or synthetic signal, rather than a list of ordinary UI labels:

| Surface | Actual source | Evidence |
| --- | --- | --- |
| Project names, statuses, priorities, telemetry, connector statuses, agents, blockers, and next actions | Compile-time `seedProjects` records | `src/data/seedProjects.ts:3-415` |
| "Agent FORCE systems online", "Project Launch Bay loaded", and "Select an agent project" Mission Console entries | Hardcoded initial React state; no health checks precede them | `src/App.tsx:95-99`, `src/App.tsx:856-864` |
| "Command Gate Safe" | Static header text; it does not read `AGENT_FORCE_ALLOW_COMMANDS` | `src/App.tsx:245-249`, `electron/main.ts:11` |
| "Refresh Fleet Signals" | Increments a local revision and timestamp; it only re-reads local Council runs | `src/App.tsx:108-111`, `src/App.tsx:279-282`, `src/App.tsx:470` |
| Connector connected/setup/attention state | Static project registry values | `src/data/seedProjects.ts:61-88`, `src/data/seedProjects.ts:279-313` |
| Connector "Check Now" result | Reference-presence check plus copied static status; no connector I/O | `src/App.tsx:684-708`, `src/App.tsx:1731-1741` |
| Readiness/automation/risk/coverage fleet metrics | Arithmetic over static telemetry and local saved artifacts | `src/App.tsx:1520-1537`, `src/App.tsx:1546-1570` |
| Trend charts / waveform | Synthetic values calculated from current telemetry and object counts, not history | `src/App.tsx:1619-1628`, `src/App.tsx:1631-1647` |
| Next Best Action and top risk | Deterministic rules over static connectors/telemetry and local Council/report state | `src/App.tsx:911-973` |
| Mentor Guidance / Mentor Tip | Hardcoded templates and deterministic branches with a hardcoded nickname | `src/mentorEngine.ts:4-47`, `src/mentorEngine.ts:50-114` |
| Council findings, engineering/product/marketing direction, readiness, and CEO decision | Synchronous renderer heuristics and fixed prose, not agent execution or source inspection | `src/council/councilEngine.ts:353-380`, `src/council/councilEngine.ts:455-491`, `src/council/councilEngine.ts:534-570` |
| Daily Mission Report | Renderer template generated from registry telemetry, agents, connectors, next actions, and optional deterministic Council run | `src/reportEngine.ts:55-151` |
| Qwen model status and chat | Live main-process configuration/HTTP; this is not a static cockpit signal | `src/components/QwenChatPanel.tsx:68-106`, `src/components/QwenChatPanel.tsx:117-167` |

## 11. Inference architecture verification

### Source-backed architecture

- Default endpoint/model are `http://127.0.0.1:8080/v1` and `Qwen/Qwen3.6-35B-A3B`; key comes only from main-process environment (`electron/main.ts:36-47`, `.env.example:1-5`).
- Managed local runtime defaults to `Qwen3.6-35B-A3B-UD-Q4_K_M.gguf`, 8,192 context, 12 GPU layers, one parallel slot, flash attention, q8 KV cache, and Jinja (`electron/localLlmRuntime.ts:36-45`, `electron/localLlmRuntime.ts:81-103`, `.env.example:12-13`).
- The process binds to host/port parsed from the configured base URL and can pass bearer auth by key file (`electron/localLlmRuntime.ts:78-104`).
- The only model surface is the project cockpit's `QwenChatPanel`, mounted directly below the project command header (`src/App.tsx:746-762`).
- Streaming is OpenAI-compatible SSE parsed in main and relayed over a per-request IPC event channel (`electron/main.ts:246-287`, `electron/preload.ts:11-19`).
- Health is `GET /v1/models`, but managed startup can precede it and exceed the 5-second HTTP timeout (`electron/main.ts:221-229`, `electron/localLlmRuntime.ts:125-152`).
- Repointing to a hosted HTTP(S) base URL skips local autostart and uses the same fetch path, but hosted compatibility is untested (`electron/main.ts:50-55`, `electron/localLlmRuntime.ts:155-162`, `package.json:8-36`).

### Live host snapshot, 2026-08-12

The following observations were made without printing the key. Each runtime value has the source location that configures or verifies it.

| Observation | Result | Code anchor |
| --- | --- | --- |
| Installed llama.cpp | `version 10375 (ba360efe1)`, Clang 20.1.8, not b1037 | Setup fetches unpinned latest release: `scripts/setup-local-qwen.ps1:72-108` |
| Listener command | `127.0.0.1:8080`, alias `Qwen/Qwen3.6-35B-A3B`, UD-Q4_K_M model, context 8192, GPU layers 12, parallel 1, API-key file | `electron/localLlmRuntime.ts:78-104` |
| GPU | NVIDIA GeForce RTX 4060 Laptop GPU, 8,188 MiB | GPU-layer configuration: `electron/localLlmRuntime.ts:86-87` |
| Runtime log | Model loaded with one slot and `n_ctx_slot = 8192`; log warns that GPU layers were explicitly fixed at 12 | Logging and arguments: `electron/localLlmRuntime.ts:86-91`, `electron/localLlmRuntime.ts:106-112` |
| Auth | Unauthenticated `POST /v1/chat/completions` returned HTTP 401; unauthenticated `GET /v1/models` returned HTTP 200 | Auth verification logic targets chat completion: `scripts/verify-local-qwen.mjs:42-51` |
| Authenticated health | Passed in 44 ms | `scripts/verify-local-qwen.mjs:36-40` |
| Incremental streaming | Passed: first token 1,123 ms, 7 content events, coherent completion | `scripts/verify-local-qwen.mjs:54-98` |
| Projector | `LLAMA_MMPROJ_PATH` is unset in the live `.env`; setup does not download/configure one | Optional runtime behavior: `electron/localLlmRuntime.ts:42`, `electron/localLlmRuntime.ts:95-100`; example ends at `LLAMA_CONTEXT_SIZE`: `.env.example:8-13` |

The exact CPU/GPU layer split beyond the configured 12 GPU layers is not emitted by the current log, so CPU remainder is recorded as UNKNOWN rather than inferred. The runtime version, `/models` auth behavior, health timing, cancellation, and projector state differ from the supplied expected architecture; see `DRIFT.md`.

## 12. Phase gate

Phase 0 produced this map plus `SYSTEM_MAP.mmd`, `DRIFT.md`, and `UNKNOWNS.md`. No fleet, connector, mentor, or application implementation was performed.
