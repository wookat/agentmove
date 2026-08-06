---
"agentmove-cli": minor
---

New client: OpenCode (`opencode`). Migrates MCP servers from
`~/.config/opencode/opencode.json` (`mcp` root; `type: local` with argv
`command` arrays + `environment`, `type: remote`, `enabled` flags all
normalized), instructions (`~/.config/opencode/AGENTS.md`), and native
SKILL.md skills (`~/.config/opencode/skills/`). Project scope via
`--project` (`opencode.json` + `AGENTS.md` + `.opencode/skills`).
