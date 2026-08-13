# Qwen Performance Log

Date: 2026-08-13

## Test Contract

All comparisons used `scripts/benchmark-qwen.mjs` with:

- A byte-stable 233-token system prompt.
- One user prompt requesting integers 1 through 100.
- `temperature: 0`.
- `max_tokens: 64`.
- `cache_prompt: false`.
- `chat_template_kwargs.enable_thinking: false`.
- One server slot and 8,192-token context.

Hardware: Intel Core Ultra 7 155H, 16 physical cores / 22 logical processors, RTX 4060
Laptop GPU with 8,188 MiB VRAM.

## Baseline

Flags:

```text
--ctx-size 8192 --n-gpu-layers 12 --parallel 1
--flash-attn on --cache-type-k q8_0 --cache-type-v q8_0 --jinja
```

Primary baseline:

| Metric | Result |
| --- | ---: |
| Load time | 9.99 s |
| Request elapsed | 15.215 s |
| Prompt evaluation | 33.3807 tokens/s |
| Generation | 8.0626 tokens/s |
| Generated tokens | 64 |

A later same-flags control run measured 15.563 s, 27.3394 prompt tokens/s, and 9.3880
generation tokens/s. Results are materially noisy, so only large directional changes
were considered for retention.

## Tensor Inspection

The GGUF is version 3 with 733 tensors, 54 metadata entries, and 40 transformer blocks.
The sparse expert tensors are named exactly:

```text
blk.N.ffn_down_exps.weight
blk.N.ffn_gate_exps.weight
blk.N.ffn_up_exps.weight
```

Shared experts and routers use distinct names including `*_shexp.weight`,
`ffn_gate_inp.weight`, and `ffn_gate_inp_shexp.weight`. There are 320 expert/FFN-related
tensors. The tested sparse-expert regex was:

```text
.*ffn_(down|gate|up)_exps\.weight=CPU
```

## Experiments

| Change from baseline | Load | Prompt tok/s | Generation tok/s | Total | VRAM | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `--n-gpu-layers all` plus sparse expert regex to CPU | 8.087 s | 6.7708 | 14.2896 | 39.041 s | 2614 MiB | Reverted |
| Same expert placement plus `--no-mmap` | 26.838 s | 8.4904 | 13.1403 | 32.517 s | 2614 MiB | Reverted |
| Baseline plus `--threads 16 --threads-batch 16` | 11.964 s | 16.7627 | 9.6371 | 20.651 s | not captured | Reverted |
| Baseline plus `--batch-size 1024` | 11.749 s | 8.9393 | 8.8670 | 33.395 s | 6489 MiB | Reverted |
| Baseline plus `--ubatch-size 256` | 10.540 s | 9.7073 | 10.5020 | 30.201 s | 6431 MiB | Reverted |

The expert strategy increased generation speed but made the 233-token prompt much
slower, so end-to-end latency was worse. `--no-mmap` followed the server's warning for
CPU tensor overrides but remained slower. Both batch reductions sharply reduced prompt
throughput. No experimental runtime flag remains in the application.

## Already-Retained Optimizations

- Flash attention is on.
- K and V cache use `q8_0`.
- Parallelism is one slot, avoiding duplicate context memory.
- The model is warmed from `app.whenReady`, not first user send.
- The system/project prefix is deterministic. No timestamp, UUID, or random key order is
  injected into the prefix.
- Prefix reuse is working. One uncached app request evaluated 236 prompt tokens in
  31.432 s at 7.51 tokens/s. A follow-up reused the longest common prefix and evaluated
  only 20 new tokens in 1.079 s.

## Deliberately Not Changed

- Context was not reduced below 8,192 because conversation retention policy and maximum
  project-context size are product decisions, not mechanical tuning facts.
- Speculative decoding was not enabled because it requires a compatible draft model and
  changes the deployed model architecture.
- Flash attention and q8 K/V were not A/B tested because they were already active in the
  baseline requested by the task.

## Verdict

Warm, prefix-reused turns can feel interactive, but uncached TTFT is not consistently
viable for synchronous mentor guidance. Deterministic rules should render the action
immediately; Qwen should add rationale asynchronously.
