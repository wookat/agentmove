---
"agentmove-cli": minor
---

Continue user-level MCP block files: servers defined in `~/.continue/mcpServers/` (YAML files with an `mcpServers:` list plus claude-style JSON maps) are now exported alongside the `config.yaml` list, matching Continue's own loading. `config.yaml` entries win duplicate names with a per-entry warning, and the project adapter's `.continue/mcpServers/` reads share the same parser and duplicate handling. Imports are unchanged and never write the block files.
