---
"agentmove-cli": minor
---

Custom agents layer for Cursor: migrate subagent markdown definitions in
`~/.cursor/agents/` (user) and `.cursor/agents/` (project, with `--project`)
byte-faithfully, with an honest warning that `model`/`read_only`/`is_background`
frontmatter is client-specific.
