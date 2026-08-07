---
"agentmove-cli": minor
---

Add Trae (ByteDance) as the 28th supported client. User scope migrates global
Agent Skills (`~/.trae/skills/`) — user-level MCP servers, rules, and memories
are app-managed through the Settings UI and are warned. `--project` covers
`.trae/mcp.json` (`mcpServers`, no `type` or `disabled` field — needs the
"Enable Project MCP" toggle, warned), `.trae/rules/*.md`, and `.trae/skills/`.
