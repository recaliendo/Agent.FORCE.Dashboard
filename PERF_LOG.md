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

Three additional baseline runs before the second pass measured 13.979, 6.729, and
8.373 seconds. The first request still paid memory-mapping/page-in cost; the two warm
runs averaged 7.551 seconds, 100.4 prompt tokens/s, and 12.7 generation tokens/s.

## Retained Profile

llama.cpp was upgraded from build 10375 to build 10423. The retained flags are:

```text
--ctx-size 8192 --n-gpu-layers all --n-cpu-moe 32 --parallel 1
--flash-attn on --cache-type-k q8_0 --cache-type-v q8_0
--load-mode none --jinja
```

This keeps attention/shared tensors and the final eight expert layers on the GPU while
loading the first 32 sparse expert layers into system RAM. Eager loading shifts disk
page-in work into startup instead of the first user request.

| Run | Elapsed | Prompt tok/s | Generation tok/s |
| --- | ---: | ---: | ---: |
| 1 | 3.729 s | 127.7 | 35.2 |
| 2 | 3.071 s | 173.2 | 37.8 |
| 3 | 3.229 s | 168.6 | 35.2 |

The retained profile averages 3.343 seconds. Against the two-run warm baseline it cuts
end-to-end latency by 55.7% and increases generation throughput by approximately 2.8x.
It leaves approximately 1.58 GB of VRAM free with the Electron app closed.

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
| `all` GPU layers plus `--n-cpu-moe 32` using mmap | 12.796 s | 64.9-123.8 | 31.4-34.0 | 3.822-5.701 s warm | 6423 MiB | Improved, then superseded |
| Same MoE placement plus `--load-mode none` | 22.612 s | 132.7-156.8 | 33.8-34.4 | 3.408-3.712 s | 6415 MiB | Retained |
| Same profile with `--n-cpu-moe 31` | 22.389 s | 113.8-162.4 | 31.1-32.3 | 3.473-4.124 s | 6877 MiB | Reverted |
| Same profile with `--threads 8 --threads-batch 8` | about 22 s | 118.2-162.2 | 33.8-34.3 | 3.361-3.937 s | 6415 MiB | Neutral; default retained |
| MTP GGUF plus `draft-mtp`, predictable sequence | 25.169 s | 124.6-170.4 | 50.7-56.1 | 2.553-3.176 s | 7149 MiB | Not defaulted |
| MTP GGUF plus `draft-mtp`, natural advisor reply | already loaded | 72.1-81.9 | 35.1-43.5 | 4.564-5.289 s | 7149 MiB | No general gain |
| Same MTP target without speculation, natural reply | already loaded | 85.1-85.7 | 37.3-39.5 | 4.770-4.897 s | 6414 MiB | Faster average and safer |
| MTP with `--n-cpu-moe 33` | failed | n/a | n/a | CUDA OOM during load | n/a | Rejected |
| MTP with block 32 experts forced to CPU | 23.128 s | n/a | n/a | CUDA OOM on first request | 6664 MiB idle | Rejected |
| MTP context reduced to 4096 | 24.999 s | not run | not run | n/a | 7102 MiB | Rejected; saved only 47 MiB |
| `ngram-mod`, three varied advisor replies | about 23 s | 55.6-82.4 | 27.5-34.3 | 5.041-6.420 s | about 6414 MiB | Rejected |

The expert strategy increased generation speed but made the 233-token prompt much
slower, so end-to-end latency was worse. `--no-mmap` followed the server's warning for
CPU tensor overrides but remained slower. Both batch reductions sharply reduced prompt
throughput. The second pass found that llama.cpp's native partial CPU-MoE option avoids
the cross-device overhead of forcing every sparse expert tensor to CPU.

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
- Chat history now includes only successful turn pairs and is capped at six retained
  turns. Prompt size reached 394 tokens on turn seven and remained 394 on turn eight.
- The response ceiling is 512 tokens instead of 1,024, reducing worst-case slot time.
- An early Send awaits the shared startup promise. In the Electron acceptance run, the
  request stayed in connecting state until runtime readiness, then completed; the next
  prefix-reused turn completed in 0.64 seconds.
- Final provider verification measured a 950 ms first token across seven incremental
  content events. Cancelling a live UI request returned the only slot to idle in 1.181
  seconds.

## Deliberately Not Changed

- Context remains 8,192 because a 4,096-token MTP trial saved only 47 MiB. Conversation
  growth is controlled by the six-turn application bound instead.
- The checksum-verified MTP Q4_K_M artifact was evaluated. It accelerated highly
  predictable text but did not improve average natural advisor latency and reduced VRAM
  headroom to 808 MiB, so `LLAMA_SPEC_TYPE=none` remains the stable default.
- Flash attention and q8 K/V were not A/B tested because they were already active in the
  baseline requested by the task.

## Verdict

The retained local profile makes short and medium Agent FORCE chat responses interactive
on this hardware. Long or highly contextual prompts still benefit from deterministic
actions rendering immediately while Qwen adds rationale asynchronously.
