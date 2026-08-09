---
"agentmove-cli": minor
---

Continue block directories are now walked recursively, matching Continue's own loader: MCP block files in nested subdirectories of `~/.continue/mcpServers/` (and project `.continue/mcpServers/`) plus nested `prompts`/`rules` YAML block files are discovered in sorted relative-path order. Single-server JSON files keep their basename-derived names and duplicate handling is unchanged.
