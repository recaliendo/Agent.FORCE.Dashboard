# Qwen UI State Matrix

| State | User-visible copy | Entered when | Exit or recovery |
| --- | --- | --- | --- |
| `connecting` | Opening a connection to the Qwen runtime. | Send dispatches a new request. | Advances to prompt evaluation or an error state. |
| `prompt-evaluating` | Qwen is evaluating the project context and prompt. | The request is active and no visible token has arrived after the initial connection phase. | First token advances to generating. Cancel is available. |
| `generating` | Response tokens are arriving. | The first `delta.content` token arrives. | Done, Cancel, inactivity timeout, parse error, auth failure, or provider failure. |
| `complete` | Response complete. | The parser receives `data: [DONE]`. | Terminal state; Send becomes available. |
| `cancelled` | Generation cancelled and the server slot was released. | The operator presses Cancel or main classifies an abort as cancelled. | Terminal state; prompt can be edited and sent again. |
| `auth-failed` | Authentication failed. Check the configured provider credential. | Provider returns HTTP 401. | Correct environment credential and retry. |
| `inactivity-timeout` | Generation stopped because no token arrived before the inactivity limit. | No visible token arrives within the configured inactivity window. | Check load/performance, then retry. |
| `parse-error` | The provider returned a stream frame the app could not parse. | A non-terminal SSE data frame is invalid JSON. | Inspect provider compatibility/logs and retry after correction. |
| `server-unavailable` | The Qwen endpoint is unavailable. Check the runtime and host/port settings. | Connection, HTTP, bridge, or unclassified provider failure occurs. | Start the runtime or correct `LLM_BASE_URL`, then use Health. |

Every assistant lifecycle bubble also displays elapsed seconds and the number of content
events received. The panel never renders an empty assistant bubble or a bare ellipsis.

Assistant content is rendered through the incremental Markdown pipeline. Completed lines
become headings, lists, emphasis, inline code, or fenced code while the unfinished line
remains a lightweight pending block. No provider HTML is injected into the document.
