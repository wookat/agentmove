---
"agentmove-cli": minor
---

Custom agents layer for CodeBuddy: migrate custom sub-agent markdown
definitions in `~/.codebuddy/agents/` (user) and `.codebuddy/agents/`
(project, with `--project`) byte-faithfully, with an honest warning that
`tools`/`model`/`effort`/`maxTurns`/`memory`/`mcpServers` frontmatter is
client-specific.
