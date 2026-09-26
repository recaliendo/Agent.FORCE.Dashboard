# OurFamilyWizard integration

The DivorceAgent cockpit includes an OFW panel backed by the local `ofw-readonly` MCP server.

The Electron main process starts the connector through `ofw.local.json`. That file is ignored by Git because it contains machine-specific paths. It currently points at the local read-only launcher configured during setup.

The bridge enforces these controls on every request:

- `OFW_WRITE_MODE=none`
- `OFW_ALLOW_MARK_READ=false`
- `OFW_FETCH_UNREAD_BODIES=false`
- no draft, send, calendar-write, expense-write, or journal-write tools

Use the **DivorceAgent** project cockpit to connect, sync, and search. Searches support message text, folder, date range, expenses, expense totals, and calendar ranges. Each displayed response can be exported as JSON. The local Qwen connection can analyze only the displayed response when you select **Ask local Qwen for insights**.

The panel exposes completeness and freshness metadata from OFW. Treat `complete:false`, stale results, and unavailable unread bodies as limitations in any case summary.

If the connector path changes, edit the ignored `ofw.local.json` file with absolute paths for the Node executable and read-only launcher. Never put the OFW username or password in this repository.
