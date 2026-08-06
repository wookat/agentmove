---
"agentmove-cli": minor
---

New client: Qwen Code (`qwen`). Migrates MCP servers from
`~/.qwen/settings.json` (`mcpServers`; remote `url`/`httpUrl` both accepted),
instructions and saved memories from `~/.qwen/QWEN.md` (the "Qwen Added
Memories" section round-trips as the memory layer), and native SKILL.md
skills (`~/.qwen/skills/`). Project scope via `--project`
(`.qwen/settings.json` + `QWEN.md` + `.qwen/skills`). Also: `httpUrl`
(Gemini CLI / Qwen streamable-HTTP spelling) is now recognized when parsing
MCP entries everywhere.
