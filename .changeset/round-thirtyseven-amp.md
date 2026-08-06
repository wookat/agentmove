---
"agentmove-cli": minor
---

New client: Amp (`amp`, by Sourcegraph). Migrates MCP servers from the
`amp.mcpServers` key of `~/.config/amp/settings.json` (local
`command`/`args`/`env`, remote `url`/`headers`), global instructions from
`~/.config/amp/AGENTS.md`, and skills from the `~/.agents/skills/` standard
location. Project scope via `--project` (workspace `.amp/settings.json`
servers — flagged as requiring `amp mcp approve` — plus `AGENTS.md` and
`.agents/skills/`).
