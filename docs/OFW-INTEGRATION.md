# OurFamilyWizard integration

The Legal Ops cockpit includes an OFW panel backed by the local read-only OFW MCP connector ([caliendohomes-rgb/RCOFWMCP](https://github.com/caliendohomes-rgb/RCOFWMCP)).

The Electron main process starts the connector through `ofw.local.json`. That file is ignored by Git because it contains machine-specific paths: absolute paths for the Node executable (`nodePath`) and the connector launcher (`launcherPath`, e.g. `…/RCOFWMCP/dist/index.js`). Never put the OFW username or password in this repository.

The bridge enforces these controls on every request:

- `OFW_WRITE_MODE=none`
- `OFW_ALLOW_MARK_READ=false`
- `OFW_FETCH_UNREAD_BODIES=false`
- no draft, send, calendar-write, expense-write, or journal-write tools (the connection is refused if the connector exposes any)

## Natural-language search (Messages tab)

The Messages tab takes a question, not just exact words: *"what did she say about the dentist last month?"*

- **Ask a question** (default) runs `ofw_search_messages`. The question is read for dates ("last month", "since March", "between May 1 and June 15"), who wrote it ("she said" / "from my ex" → received, "I told her" → sent, "from Sarah"), topic words with related co-parenting wording (pay ↔ reimburse/receipt, pickup ↔ exchange/drop-off), and typos. Quoted text matches exactly; `-word` or `NOT word` excludes.
- **Exact words** matches the whole text literally, still ranked, with the match highlighted.
- A **Read as** line shows exactly how the question was interpreted. The Folder selector and the optional dates override it.
- Each result keeps the source in view: message number, sender → recipient, sent time, subject, and a passage with the matches highlighted, plus **View message** and **Copy citation**.
- If the connector cannot vouch for an empty result, the panel says it is *not verified* and offers **Sync with OurFamilyWizard and search again** instead of reporting "nothing found".

If the configured connector predates `ofw_search_messages`, the dashboard pages through `ofw_list_messages` and ranks locally with the same engine (`electron/ofw-nlp/`, vendored from RCOFWMCP `src/search/`). **Check connection** reports which path is in use.

## Grounded analysis with local Qwen

The **Local Qwen** bar under the search box runs one of four tasks on the relevant messages:

| Action | Output |
| --- | --- |
| Answer my question | A direct answer to the question typed above |
| Summarize | What the messages on the topic say, grouped by theme |
| Build timeline | Dated events, oldest first |
| Commitments & requests | Who agreed to, asked for, or refused what, and what is unresolved |

How it works (`electron/ofw-grounding.ts`, IPC `agent-force:ofw-analyze`):

1. Natural-language search retrieves the most relevant messages (bodies included where cached).
2. Only a bounded set of excerpts is sent: by default up to 8 messages and 6,000 characters, each excerpt centred on the matched text and labelled `[#<message number>] <date> · From … to … · Subject …`.
3. The model is instructed to use only those excerpts, cite every claim as `[#123]`, report what a message *says* rather than whether it is true, stay neutral, give no legal advice, and say "The retrieved messages don't show this." when they don't.
4. The answer streams in with each citation as a button that jumps to its excerpt. The excerpts the model was given are listed under the answer. An answer that cites nothing is flagged as unsupported. Coverage limits (incomplete result, bodies not cached, only the top N of M matches read) are shown.

The Qwen chat panel uses the same retrieval for Legal Ops questions (IPC `agent-force:ofw-chat-context`): the relevant message excerpts, plus expense totals and recent expenses only for money questions, and nearby calendar events only for schedule questions. It no longer sends the entire record with every question.

### Privacy rule: local model only

OFW content is only sent to a model on this computer. If `LLM_BASE_URL` is not a loopback address (`127.x.x.x`, `localhost`, `::1`), analysis and chat grounding are refused with an explanation. Setting `OFW_ALLOW_REMOTE_LLM=true` is the explicit opt-out for anyone who accepts sending records to that provider.

### Settings (`.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `OFW_ANALYSIS_MAX_MESSAGES` | `8` (1–20) | Messages sent to the model per analysis |
| `OFW_ANALYSIS_MAX_CHARS` | `6000` (1,500–24,000) | Total excerpt characters per analysis. The default fits the 8,192-token local context with room for the answer |
| `OFW_ALLOW_REMOTE_LLM` | unset | `true` allows OFW content to go to a non-local model |
| `DISPLAY_TZ` | `America/New_York` | Zone for relative dates ("last week") in the local-ranking fallback; match the connector's |

## Coverage

The panel exposes completeness and freshness metadata from OFW. Treat `complete:false`, stale results, and unavailable unread bodies as limitations in any case summary. Each displayed response, including any analysis with its sources, can be exported as JSON.
