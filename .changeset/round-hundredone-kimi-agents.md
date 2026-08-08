---
"agentmove-cli": minor
---

Custom agents layer for Kimi Code CLI: migrate custom agent markdown
definitions recursively from `~/.kimi-code/agents/` and the shared
`~/.agents/agents/` root (user; brand dir wins name conflicts) and
`.kimi-code/agents/` + `.agents/agents/` (project, with `--project`)
byte-faithfully, preserving subdirectory paths; imports write only the
brand-native `.kimi-code/agents/` directory, with an honest warning that
`tools`/`disallowedTools`/`subagents`/`model_preference`/`override`
frontmatter is client-specific.
