---
"agentmove-cli": minor
---

Custom agents layer for Qoder CLI: migrate custom subagent markdown
definitions in `~/.qoder/agents/` (user) and `.qoder/agents/` (project, with
`--project`) byte-faithfully, with an honest warning that
`tools`/`model`/`skills`/`mcpServers` frontmatter is client-specific.
