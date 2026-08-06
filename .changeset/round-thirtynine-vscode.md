---
"agentmove-cli": minor
---

New client: VS Code (`vscode`, Copilot agent mode). Migrates MCP servers from
the user-profile `mcp.json` (`servers` map; stdio `command`/`args`/`env`,
remote `type: http`/`sse` + `url`/`headers`), checking all three platform
profile folders and writing back to the existing file or the current
platform's default. `inputs` placeholders are preserved untouched; `envFile`
references are dropped with a warning. Project scope via `--project`
(`.vscode/mcp.json` + `.github/copilot-instructions.md`).
