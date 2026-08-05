---
"agentmove-cli": minor
---

New client: Windsurf (`windsurf`). Migrates MCP servers via
`~/.codeium/windsurf/mcp_config.json` (remote servers normalized between
`serverUrl` and the portable `url`) and global rules via
`~/.codeium/windsurf/memories/global_rules.md` (instructions layer).
`--project` migrates `.windsurf/rules/*.md`. Cascade memories are app-managed
and cannot be migrated; skills have no Windsurf equivalent — both are skipped
with warnings.
