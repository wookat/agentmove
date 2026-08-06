---
"agentmove-cli": minor
---

Add Warp (warp.dev) as the 25th supported client: user-level MCP servers in
`~/.warp/.mcp.json` (`mcpServers` map — alternate wrapper keys `mcp_servers`/
`servers` are read and preserved on merge; entries have no `type` field, stdio
uses `command`/`args`/`env` + `working_directory` mapped to portable `cwd`,
remote servers are plain `url` entries with auto-negotiated transport; no
`disabled` flag, warned), and project scope via `.warp/.mcp.json` + `AGENTS.md`
(legacy `WARP.md` is read). Warp global rules live in Warp Drive (app-managed)
and skills are app-bundled — those layers are skipped with warnings.
