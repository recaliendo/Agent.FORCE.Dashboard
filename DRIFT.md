# Phase 0 Drift List

Priorities describe architectural/security impact, not implementation order. No fixes were made in Phase 0.

## Hard findings

1. **P0 - Base URL and runtime filesystem paths cross into the renderer.** `qwenConfig` returns `baseUrl`, `serverPath`, `modelPath`, and `logPath`; health also returns `baseUrl` (`electron/main.ts:209-228`, `src/types.ts:132-144`). This directly conflicts with the required rule that the renderer must not receive a key, base URL, or auth header.
2. **P0 - The LLM key is renderer-reachable when command execution is enabled.** Main loads the key into `process.env`; `runCommand` executes an arbitrary renderer string with default inherited environment and returns stdout/stderr (`electron/main.ts:18-34`, `electron/main.ts:183-204`). A renderer command can print `LLM_API_KEY`. The default-disabled gate reduces exposure but does not preserve the credential boundary after enablement.
3. **P0 - Provider error content is not redacted.** Non-2xx response bodies and the configured base URL are embedded in errors returned or streamed to renderer (`electron/main.ts:88-101`, `electron/main.ts:221-242`, `electron/main.ts:282-285`). This does not meet the requirement that credentials never be echoed in an error.

## Inference architecture drift

4. **P1 - Health can exceed five seconds.** `qwenHealth` first awaits managed startup, whose default deadline is 180 seconds, and only then performs the five-second `/models` fetch (`electron/main.ts:221-229`, `electron/localLlmRuntime.ts:125-152`). Startup on app ready is asynchronous and only logs failure, so the app does not fail loudly and fast at startup (`electron/main.ts:289-293`).
5. **P1 - Streaming is not cancellable.** Renderer cleanup removes only the IPC listener; there is no cancel IPC and main continues reading the HTTP body (`electron/preload.ts:11-19`, `electron/main.ts:246-287`, `src/components/QwenChatPanel.tsx:79-91`). Navigation/unmount therefore does not guarantee that the single llama slot is freed.
6. **P1 - The five-second timeout covers response headers, not response consumption.** `qwenFetch` clears its abort timer before `response.json()` or SSE reads occur (`electron/main.ts:73-104`, `electron/main.ts:232-287`). A provider can leave an established response body open indefinitely.
7. **P1 - Installed llama.cpp is not the supplied b1037.** Live `llama-server --version` returned `10375 (ba360efe1)`. The setup script always queries `releases/latest`, so the build is not pinned or reproducible (`scripts/setup-local-qwen.ps1:72-108`).
8. **P1 - `/models` is not protected in the live server.** Live unauthenticated `GET /v1/models` returned 200, while unauthenticated chat returned 401. The verification script asserts chat auth only (`scripts/verify-local-qwen.mjs:42-51`). The broad statement "401 when unauthenticated" is therefore true for inference but false for the health endpoint.
9. **P1 - No tool-call passthrough exists.** Request types have only system/user/assistant roles, request bodies omit `tools`, and parsers consume only text content (`electron/main.ts:13-16`, `electron/main.ts:107-117`, `electron/main.ts:235-240`, `electron/main.ts:272-276`). The local server may support tool calls, but this application path does not.
10. **P1 - Projector state differs from the supplied runtime expectation.** `LLAMA_MMPROJ_PATH` is optional in code, absent from `.env.example`, and unset on the live host; setup downloads only the GGUF model (`electron/localLlmRuntime.ts:42`, `electron/localLlmRuntime.ts:95-100`, `.env.example:8-13`, `scripts/setup-local-qwen.ps1:110-149`). Whether this specific deployed GGUF needs a projector remains UNKNOWN.
11. **P2 - Hosted provider support is architectural, not verified.** A non-loopback `LLM_BASE_URL` skips local autostart and uses the same OpenAI-compatible fetch, but there is no hosted-provider automated test (`electron/localLlmRuntime.ts:155-162`, `electron/main.ts:73-119`, `package.json:8-36`).
12. **P2 - Chat contracts are duplicated and text-only.** Main `ChatMessage` and renderer `QwenChatMessage` are separate declarations with no shared runtime validator (`electron/main.ts:13-16`, `src/types.ts:127-158`, `src/types.ts:238-252`).

## Connector and signal drift

13. **P1 - The connector UI is not a connector runtime.** GitHub, Netlify, Supabase, Stripe, and custom connectors are enum-tagged references; no adapters authenticate, poll, or invoke their APIs (`src/types.ts:26-42`, `src/types.ts:75-89`, `src/App.tsx:1675-1753`).
14. **P1 - StandardCraft MCP cannot mount with zero new code.** There is no MCP dependency, client transport, server registry, tool discovery, invocation contract, or matching IPC (`package.json:20-36`, `electron/main.ts:161-287`, `src/types.ts:26-38`).
15. **P1 - "Check Now" can look live while checking only metadata.** It tests reference presence, copies the static status, and writes a local timestamp/reason (`src/App.tsx:684-708`). No outbound connector call occurs.
16. **P1 - The connectors tab badge double-counts an unresolved connector.** The same connector is counted in both `connectorAttention` and `uncheckedConnectors`, then summed (`src/App.tsx:982-1002`). This explains a badge of 2 alongside `1 setup needed`; the badge is not a connector count.
17. **P1 - Fleet telemetry is static or synthetic.** Readiness/risk/status values come from source records, and trend lines are formulas over current values rather than time-series data (`src/data/seedProjects.ts:3-415`, `src/App.tsx:1520-1570`, `src/App.tsx:1619-1628`).
18. **P1 - Council labels imply review work that does not happen.** Council runs synchronously execute renderer heuristics and fixed prose; they do not inspect repositories, run QA/builds, call agents, or gather evidence (`src/council/councilEngine.ts:353-380`, `src/council/councilEngine.ts:455-491`, `src/council/councilEngine.ts:534-570`).
19. **P1 - Daily reports inherit unverified registry values.** Reports present executive summaries and operating posture generated from static telemetry/connector statuses and deterministic Council data (`src/reportEngine.ts:55-151`).
20. **P1 - Mentor guidance is static deterministic prose.** It is not generated, provenance-tagged, or grounded in live connector results (`src/mentorEngine.ts:4-114`, `src/App.tsx:348-388`).
21. **P2 - Registry persistence is dead code.** `safeReadRegistry` and `safeWriteRegistry` exist, while the app imports and renders `seedProjects` directly and settings says durable edits require source changes (`src/storage.ts:101-107`, `src/App.tsx:35`, `src/App.tsx:101-102`, `src/App.tsx:1341-1377`).

## Product, packaging, and security drift

22. **P1 - Renderer sandboxing is disabled.** Context isolation and disabled Node integration are positive controls, but `sandbox:false` weakens the intended process boundary (`electron/main.ts:130-135`).
23. **P1 - Command enablement is broader than UI need.** Once enabled, `runCommand` accepts any command string and returns raw process output; it is not scoped to registered action IDs (`electron/main.ts:183-204`, `electron/preload.ts:6`).
24. **P2 - `AGENT_FORCE_ALLOW_COMMANDS` is evaluated before `.env` is loaded.** A value placed in `.env` cannot enable commands because `allowCommands` is computed at module initialization before `loadDotEnv()` (`electron/main.ts:10-11`, `electron/main.ts:18-34`). Shell-level configuration works as documented (`README.md:193-203`).
25. **P2 - Production packages omit runtime setup utilities.** The installer includes only built app files and package metadata, but runtime errors instruct users to run `npm run qwen:setup`; setup scripts are not in the package (`package.json:44-47`, `electron/localLlmRuntime.ts:71-75`).
26. **P2 - README landing behavior is stale.** README says the app opens on Project Launch Bay, while `App` initializes to the first seed project (`README.md:5`, `src/App.tsx:90-101`).
27. **RESOLVED - Licensed persona layer removed.** Council agents now use functional role names and the illustrated persona components were deleted.
28. **P2 - No automated test harness exists.** Typecheck/build and a standalone Qwen verifier exist, but no unit, integration, Electron, or connector test script is configured (`package.json:8-36`).
