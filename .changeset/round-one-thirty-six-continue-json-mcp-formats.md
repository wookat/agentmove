---
"agentmove-cli": minor
---

Continue JSON MCP block files now support the full upstream loader matrix: JSONC comments, claude-code style files with `projects` nesting, and single-server files (server name = filename), in both `~/.continue/mcpServers/` and project `.continue/mcpServers/`. `envFile` on stdio entries emits a not-migrated warning and unsupported file shapes are skipped with an explicit warning instead of being silently ignored.
