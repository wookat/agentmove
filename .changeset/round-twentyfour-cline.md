---
"agentmove-cli": minor
---

New client: Cline (`cline`). Migrates MCP servers via
`~/.cline/data/settings/cline_mcp_settings.json` (remote transports normalized
between Cline's `type: streamableHttp`/`sse` and the portable model, `disabled`
flag mapped to the portable enabled state) and global rules via
`~/Documents/Cline/Rules/*.md` (instructions layer). `--project` migrates
`.clinerules/*.md`. The VS Code extension's own MCP settings copy in VS Code
globalStorage is not touched; skills have no Cline equivalent — skipped with
warnings.
