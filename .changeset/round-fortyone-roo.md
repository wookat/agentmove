---
"agentmove-cli": minor
---

New client: Roo Code (`roo`). Migrates MCP servers from the VS Code
globalStorage `mcp_settings.json` (stdio + streamable-http/sse remotes with
Roo's required explicit `type`, native `disabled` flag preserved), global
rules from `~/.roo/rules/` as instructions, and `~/.roo/skills/` Agent
Skills. Client-specific `alwaysAllow`/`disabledTools`/`timeout`/`watchPaths`
settings are reported as warnings. Project scope (`--project`) covers
`.roo/mcp.json`, `.roo/rules/`, and `.roo/skills/`.
