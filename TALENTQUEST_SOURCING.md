# TalentQuest Sourcing

Source repository: `github.com/caliendohomes-rgb/essence-map-desk`, commit `55e753ead434fee03feedb1b6b55a1ff230be7fa`.

The repository documents one whole product named **Talent Compass**, not a module named TalentQuest (`README.md:1-7`). `TalentQuest` is the Agent FORCE fleet display name required by the reconciliation brief; it is not presented as a source-repository product name.

| Dashboard field | Value | Source | Confidence |
| --- | --- | --- | --- |
| Display name | TalentQuest | Reconciliation brief, Phase 1 target fleet | Decided |
| Source product identity | Talent Compass, whole repository | `README.md:1-7` | High |
| Repository | `github.com/caliendohomes-rgb/essence-map-desk` | Readable Git remote at commit above | High |
| Category | Talent intelligence / people analytics | `README.md:3-7` | High |
| Objective | Secure ingestion, explainable talent mapping, retention and coaching plans | `README.md:7-19` | High |
| Primary users | Managers, HR, executives | `README.md:7`, `README.md:151-159` | High |
| Explainability requirement | Drivers, confidence, completeness, contributing sources | `README.md:113-133` | High |
| Safety posture | Supportive decision support; role-based visibility | `README.md:149-169` | High |
| Stack | Vite, React, TypeScript, Supabase client, Vitest | `package.json:5-13`, `package.json:45-67`, `package.json:69-90` | High |
| Status | UNKNOWN | No documented operational status | High |
| Priority | UNKNOWN | No documented dashboard priority | High |
| Configured connectors | UNKNOWN | README proposes integrations but does not prove dashboard connector configuration (`README.md:21-87`) | High |
| Dashboard agents | UNKNOWN | No agents are documented | High |
| Launch actions | UNKNOWN | No Agent FORCE launch actions are documented | High |
| Current blockers | UNKNOWN | No blockers, issues, ADRs, or TODO documents are present | High |

Unknown values render as specific empty states such as "No connectors configured" and "No agents configured." Proposed integrations from the README are not registered as live connectors.
