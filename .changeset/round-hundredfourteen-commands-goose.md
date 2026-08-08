---
"agentmove-cli": minor
---

Commands layer for goose: the global recipe library `~/.config/goose/recipes/*.yaml|json` exports as portable commands (`title`/`description` to frontmatter, `prompt`/`instructions` to the markdown body; recipe-only fields warned, not silently dropped), and imported commands are written as recipes with a `slash_commands` registration in `config.yaml` so they are invokable as `/name`. Flat scan matches goose's own discovery (nested names flattened with a warning); `.yml` recipes are unsupported by the goose CLI and warned. Project scope covers `.goose/recipes/` without touching the user-level config.
