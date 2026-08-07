---
"agentmove-cli": minor
---

Add CodeBuddy (Tencent) as the 29th supported client. User scope migrates
`~/.codebuddy/.mcp.json` MCP servers (`mcpServers` + top-level
`disabledMcpServers` name list for native disabled round-trip; JSONC accepted;
`~/.codebuddy/mcp.json` and legacy `~/.codebuddy.json` are read/write
fallbacks), `~/.codebuddy/CODEBUDDY.md` user memory as instructions, and
`~/.codebuddy/skills/` Agent Skills. `--project` covers `.mcp.json` at the
project root, `CODEBUDDY.md`, and `.codebuddy/skills/`.
