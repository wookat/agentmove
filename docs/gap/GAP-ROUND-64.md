# GAP-ROUND-64: AnythingLLM (38th client)

## Official research

- Source of truth: Mintplex-Labs/anything-llm
  `server/utils/MCP/hypervisor/index.js` (MCPHypervisor, read 2026-08).
- Config file: `<storage>/plugins/anythingllm_mcp_servers.json` with a
  top-level `mcpServers` map. Desktop storage on Linux:
  `~/.config/anythingllm-desktop/storage` (macOS:
  `~/Library/Application Support/anythingllm-desktop/storage`, Windows:
  `%APPDATA%\anythingllm-desktop\storage`, Docker: `$STORAGE_DIR`).
- Transport parsing (`#parseServerType` / `createHttpTransport`):
  - `command` present → stdio (`command`/`args`/`env`; env is merged over the
    app's PATH/NODE_PATH base env).
  - `url` present → remote; `type: "streamable"` or `"http"` → Streamable
    HTTP, anything else (including omitted `type`) → SSE.
- App block `anythingllm`:
  - `autoStart: false` skips booting the server → mapped to portable
    `enabled: false` (and rendered back as `anythingllm.autoStart: false`).
  - `suppressedTools: string[]` per-server tool suppression → client-specific
    warning; preserved on merge.
- No `cwd` support → dropped with warning.
- Workspaces, system prompts, agent flows, and chat history are app-managed
  in the server database — instructions/persona/memory/skills are skipped
  with warnings. No project scope (desktop/server app).

## Deferred

- macOS/Windows desktop storage paths and Docker `STORAGE_DIR` relocations
  are documented but the adapter reads the Linux home-relative path only
  (same posture as Jan/Claude Desktop rounds).
- `anythingllm_mcp_servers.json` may be edited live by the app's Agent Skills
  UI; AgentMove merges and preserves unknown keys per entry.
