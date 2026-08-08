---
"agentmove-cli": minor
---

Custom agents layer for Codex CLI: export/import agent role TOML files in
`~/.codex/agents/` (project scope `.codex/agents/`), scanned recursively —
a documented conversion where `name` maps to the portable agent name,
`description` to frontmatter and `developer_instructions` to the body.
Files missing any of the three required fields are warned and not migrated
(Codex rejects them), duplicate role names keep the first file found
(warned), and codex-specific settings (`model`, `model_reasoning_effort`,
`sandbox_mode`, `mcp_servers`, …) are dropped with per-field warnings.
Imports flatten nested names, synthesize a missing description, and keep
frontmatter beyond `description` verbatim inside `developer_instructions`.
Inline `[agents.<name>]` roles in `config.toml` and the Xcode-bundled
Codex root are not migrated.
