---
"agentmove-cli": minor
---

New client: GitHub Copilot CLI (`copilot`). Migrates user-level MCP servers
(`~/.copilot/mcp-config.json`, `type: local` normalized to stdio) and user
instructions (`~/.copilot/copilot-instructions.md` + `~/.copilot/instructions/`),
plus project scope via `--project` (`.mcp.json` + `.github/copilot-instructions.md`
+ `.github/instructions/`). Client-specific `tools` allowlists and the missing
disabled flag are reported as warnings, never dropped silently.
