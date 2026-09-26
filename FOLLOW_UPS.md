# Follow-Ups

These items were observed but deliberately left outside this repair.

1. Pin runtime versions. The supplied environment note said llama.cpp `b1037`, while the
   installed binary is `10375 (ba360efe1)`. Record and enforce a tested version in setup.
2. Pin JavaScript dependencies. `package.json` uses `latest` for production and build
   packages, which makes clean installs non-reproducible despite the current lockfile.
3. The chat now retains six successful turns while leaving `--ctx-size` at 8,192. Add
   summarization only if product requirements call for longer conversational memory.
4. The checksum-verified Qwen3.6 MTP Q4_K_M artifact was tested. It improved predictable
   sequences but not average natural advisor latency and left only 808 MiB VRAM free, so
   it remains an opt-in benchmark asset rather than the production default.
5. Clarify multimodal scope. The deployed command has no `mmproj` file and the dashboard
   sends text only. Add the matching projection asset only if image input becomes a real
   product requirement.
6. Continue tracking startup, uncached, and warm-prefix latency separately. Eager loading
   moved the old first-prompt page-in penalty into a roughly 21-second startup phase.
7. Consider exposing llama.cpp load progress in the renderer if managed autostart becomes
   the normal launch path. Current health copy distinguishes startup/unavailable states
   but does not report model-load percentage.
8. Review endpoint policy before binding beyond loopback. The current SSRF guard and
   loopback default are intentional security boundaries.
9. Connect Qwen rationale to the reserved deterministic action-card slot after the typed
   mentor gateway and IPC contract are approved.
10. Treat the Halo repository as navigation-only until an explicit content-filter and
    data-minimization policy is implemented. The user-supplied brief flags possible personal
    information; repository contents were not inspected during reconciliation.
11. Review the tracked TalentQuest `.env` file without exposing values, rotate any live
    credentials, and decide whether repository history remediation is required.
12. Decide whether to purge deleted character artwork from Git history. This requires a
    coordinated destructive history rewrite and downstream clone migration.
13. Replace remaining synthetic charts with time-series observations only when timestamped
    source data exists; until then, keep them labeled as derived readiness views.
