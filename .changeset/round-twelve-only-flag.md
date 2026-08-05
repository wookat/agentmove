---
"agentmove-cli": minor
---

Partial migration: `export`, `import`, and `convert` accept `--only <layers>`
(comma-separated subset of `mcp`, `skills`, `memory`, `instructions`,
`persona`) to migrate just the layers you ask for. Unknown layer names fail
with exit code 2. Shell completion and the man page cover the new flag.
