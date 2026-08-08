---
"agentmove-cli": minor
---

Custom agents layer for Kiro: migrate markdown agent definitions in
`~/.kiro/agents/` (user) and `.kiro/agents/` (project, with `--project`)
byte-faithfully, with honest warnings that `tools`/`model`/`permissions`
frontmatter is client-specific and that JSON-format agent configs are not
migrated.
