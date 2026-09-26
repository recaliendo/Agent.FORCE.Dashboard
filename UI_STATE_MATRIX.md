# Qwen UI State Matrix

Each error state comes from a specific error code sent by the main process
(`electron/qwenClient.ts`), so a problem is named for what it is, not reported as
"server unavailable".

| State | Label | User-visible copy | Entered when | Exit or recovery |
| --- | --- | --- | --- | --- |
| `connecting` | Starting | Starting the request. | Send dispatches a new request. | Advances to waiting, reading, or an error state. |
| `queued` | Waiting | Waiting for Qwen: it is finishing another request or still loading the model. | No response headers after 2.5 s. llama.cpp answers only when its single slot starts our request. | Reading starts when the slot frees. After `LLM_QUEUE_TIMEOUT_SECONDS` (default 180 s): `queue-timeout`. |
| `prompt-evaluating` | Reading | Qwen is reading the question and project context. | Response headers arrive. A progress bar shows "Reading X of Y tokens · Z reused from cache". | The first token moves to writing. Cancel is available. |
| `generating` | Writing | Writing the answer. | The first `delta.content` token arrives. | Done, Cancel, or an error state. |
| `complete` | Complete | Response complete. | The stream ends with `[DONE]` or a finish reason. The bubble shows read and write speed. If the answer hit the length limit, it adds: "The answer stopped at the N-token limit. Ask “continue” for the rest." | Terminal state; Send becomes available. |
| `cancelled` | Cancelled | Cancelled. The model stops after its current step. | The operator presses Cancel. | Terminal state. llama.cpp finishes its current batch first, so a follow-up sent at once may show Waiting briefly. |
| `auth-failed` | Key rejected | The model server rejected the API key. Run Health for the fix. | HTTP 401 or 403. | Correct `LLM_API_KEY` in `.env` so it matches the server, then retry. |
| `inactivity-timeout` | Server silent | The model server went silent mid-answer. Run Health for details. | Nothing at all — not a token, a progress frame, or the server's 30 s keep-alive — arrives for `LLM_INFERENCE_INACTIVITY_TIMEOUT_SECONDS` (default 120 s, minimum 90 s). | Run Health; the runtime log check names crashes such as GPU out of memory. |
| `parse-error` | Unreadable response | The model server sent a response the app could not read. | An SSE data frame is not valid JSON. | Check provider compatibility, then retry. |
| `context-overflow` | Too large | This request was too large for the model’s context window. | HTTP 400 `exceed_context_size_error`. The app trims history and excerpts to fit first, so this is rare. | Ask a narrower question or clear the chat. |
| `model-loading` | Model loading | The model is still loading into memory. Try again in a few seconds. | HTTP 503 "Loading model". | Retry once the model has loaded. |
| `queue-timeout` | Busy | Qwen stayed busy with another request for too long. Try again. | The request stayed queued past the queue limit. | Wait for, or cancel, the other request, then retry. |
| `runtime-failed` | Runtime failed | The local Qwen runtime could not start. Run Health for the reason. | The managed `llama-server` failed to start (missing files, or it exited). | Run Health (or `pnpm qwen:doctor -- --start`) and follow its remedy. |
| `http-error` | Server error | The model server returned an error. | Any other HTTP error, or the stream ended before the model finished. The bubble shows the server's own message. | Read the detail, then retry. |
| `server-unavailable` | Server unavailable | The local Qwen server is not answering. Run Health for details. | Nothing is listening at `LLM_BASE_URL` (connection refused or reset). | Start the runtime or correct `LLM_BASE_URL`, then run Health. |

When the app trims the conversation or the OFW excerpts to fit the context window, the
bubble shows a note saying what was left out.

Every assistant bubble also shows elapsed seconds and the number of tokens received.
The panel never renders an empty assistant bubble or a bare ellipsis.

Assistant content is rendered through the incremental Markdown pipeline. Completed lines
become headings, lists, emphasis, inline code, or fenced code while the unfinished line
remains a lightweight pending block. No provider HTML is injected into the document.
