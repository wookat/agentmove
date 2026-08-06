---
"agentmove-cli": minor
---

New client: Kiro (AWS) — `kiro`. Migrates MCP servers from `~/.kiro/settings/mcp.json` (`mcpServers`; stdio `command`/`args`/`env`, remote `url`/`headers`, native `disabled` flag), steering markdown from `~/.kiro/steering/` as instructions (AGENTS.md standard supported), and `~/.kiro/skills/` (Agent Skills standard) — in both directions, with merge-by-default MCP import and secret redaction. `autoApprove`/`disabledTools`/`oauth` settings are client-specific and reported as warnings. Project scope (`--project`) covers `.kiro/settings/mcp.json`, `.kiro/steering/`, and `.kiro/skills/`.
