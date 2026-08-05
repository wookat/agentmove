---
"agentmove-cli": minor
---

New client: Zed (`zed`). Migrates MCP servers via the `context_servers` key of
`~/.config/zed/settings.json` (JSONC parsed; unrelated settings preserved on
merge; stdio servers always emitted with `args`, which Zed's schema requires)
and personal instructions via `~/.config/zed/AGENTS.md`. `--project` migrates
`.zed/settings.json` and `.rules`. Zed Rules Library / Skills are app-managed
and not migrated; JSONC comments are not preserved on rewrite — both warned.
