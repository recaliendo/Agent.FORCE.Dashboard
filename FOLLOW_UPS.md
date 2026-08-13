# Follow-Ups

These items were observed but deliberately left outside this repair.

1. Pin runtime versions. The supplied environment note said llama.cpp `b1037`, while the
   installed binary is `10375 (ba360efe1)`. Record and enforce a tested version in setup.
2. Pin JavaScript dependencies. `package.json` uses `latest` for production and build
   packages, which makes clean installs non-reproducible despite the current lockfile.
3. Decide a context-retention budget before reducing `--ctx-size` below 8,192. Current
   chat history can grow, so a smaller limit needs an explicit truncation/summarization
   policy.
4. Consider speculative decoding only after selecting and validating a compatible draft
   GGUF. The current server reports `speculative: false`.
5. Clarify multimodal scope. The deployed command has no `mmproj` file and the dashboard
   sends text only. Add the matching projection asset only if image input becomes a real
   product requirement.
6. Track cold-prompt latency separately from warm-prefix latency. Measurements ranged
   from sub-second cached turns to more than 30 seconds for a 236-token uncached prompt.
7. Consider exposing llama.cpp load progress in the renderer if managed autostart becomes
   the normal launch path. Current health copy distinguishes startup/unavailable states
   but does not report model-load percentage.
8. Review endpoint policy before binding beyond loopback. The current SSRF guard and
   loopback default are intentional security boundaries.
9. Add a deterministic mentor-action card that does not wait for inference, then stream
   Qwen's rationale into that already-useful card.
