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
