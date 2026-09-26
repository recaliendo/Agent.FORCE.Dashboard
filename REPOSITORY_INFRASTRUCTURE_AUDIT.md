# Repository Infrastructure Audit

Audit date: 2026-08-13. Repository checks used the authenticated GitHub account and
read-only shallow checkouts. No credential values were read or printed.

## Fleet reconciliation

| Fleet project | Repository evidence | Infrastructure represented in Agent FORCE | Qualification |
| --- | --- | --- | --- |
| TalentQuest | `caliendohomes-rgb/essence-map-desk` at `55e753ead434fee03feedb1b6b55a1ff230be7fa` | GitHub, Supabase data/auth, Lovable Cloud auth | Repository reachable. Supabase and Lovable source integrations exist; live tenant, credentials, deployment, and health remain unverified. |
| Halo Portfolio Agent | Exact outbound repository retained in `repository.url` | Navigation only | Content ingestion is intentionally disabled. The public repository tracks data, logs, databases, generated output, and compiled artifacts; none were opened or added to model context. |
| StandardCraft | `caliendohomes-rgb/standardcraft` at `509f4a61c59151181269402fa2a02fbe2ffda817` | GitHub, Netlify, Supabase, Stripe, SMTP, GitHub Actions, StandardCraft Ops MCP, analytics plan | GitHub and Netlify production are reachable. Other services are source-backed but credential/health-unverified or explicitly not wired. |
| DivorceAgent | No unambiguous repository association found | Local document reference and document-vault placeholder | Repository remains `UNKNOWN`; no similarly named account repository was guessed into the fleet. |

## StandardCraft evidence

- Netlify: `netlify.toml`, `@astrojs/netlify`, Netlify Functions configuration, and a live
  `https://standardcraftny.com` response with HTTP 200, `Server: Netlify`, and an
  `X-Nf-Request-Id` header.
- Supabase: browser/server clients, auth flows, storage/download workflows, schema migrations,
  row-level security policies, audit logging, and atomic credit functions.
- Stripe: SDK dependency, checkout, billing portal, signed webhook handling, price IDs, and
  subscription-credit synchronization.
- SMTP: Nodemailer integration, a standalone SMTP verification script, and MCP environment
  contract. Delivery credentials and live mailbox health were not tested.
- GitHub Actions: typecheck, build, committed-secret scan, and gated dependency audit workflow.
- StandardCraft Ops MCP: source server for GitHub branch protection, Netlify deployment,
  Supabase form inbox, and SMTP tests. It is not mounted by the current Agent FORCE IPC layer.
- Analytics: the repository includes a provider-neutral event plan and CSP allowance, but the
  source explicitly says no provider is currently wired.

## Representation rules

1. `connected` means a non-secret endpoint or repository was directly reachable during this audit.
2. `needs_setup` means implementation exists but live credentials or runtime health were not verified.
3. `unknown` means configuration or planning evidence exists without a confirmed live service.
4. Connector metadata never stores keys, tokens, private dashboard URLs, or response payloads.
5. Repository association is never inferred from a similar account/repository name.

The GitHub account currently exposes eleven repositories to the authenticated user. Only the
repositories with direct fleet evidence are represented; unrelated and ambiguous repositories
are intentionally excluded.

## Authenticated owner catalog

The manifest/config scan covered all eleven repositories exposed for `caliendohomes-rgb`.
Empty repositories and unrelated portfolio/prototype repositories are recorded here so their
exclusion from the four-project fleet is explicit.

| Repository | Evidence observed | Fleet decision |
| --- | --- | --- |
| `Agent.FORCE.Dashboard` | Electron, React, Vite, local Qwen runtime, tests, installer config | Control-plane application; represented directly. |
| `standardcraft` | Astro, Netlify, Supabase, Stripe, SMTP, Actions, Ops MCP, analytics plan | StandardCraft source; represented with qualified connectors. |
| `essence-map-desk` | Vite/React, Supabase data/auth, Lovable Cloud auth | TalentQuest source; represented with qualified connectors. |
| `Job.SEARCH.AGENT` | Python prototype with tracked runtime/data artifacts; no deployment manifest found | Halo outbound source; navigation only and ingestion blocked. |
| `job-search-agent` | Python local job agent, SMTP contract, local tracker, tests | Separate prototype; not silently merged with TalentQuest or Halo. |
| `richard-caliendo-portfolio` | Static portfolio and `netlify.toml` | Portfolio site; unrelated to the four-project fleet. |
| `RC.Portfolio.Site` | README-only repository | No application infrastructure to connect. |
| `AI_Cert_Prep_MVP` | Empty repository | No application infrastructure to connect. |
| `F-LAW` | Empty repository | No application infrastructure to connect. |
| `Use-Case-RCJG` | Empty repository | No application infrastructure to connect. |
| `AI.Ops.SMB.PROJECT` | Empty repository | No application infrastructure to connect. |

This catalog is intentionally non-ingestive: it records manifests, provider surfaces, and
association decisions, not repository business data or credential values.
