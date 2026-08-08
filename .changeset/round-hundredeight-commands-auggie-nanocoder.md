---
"agentmove-cli": minor
---

Commands layer for Auggie CLI and Nanocoder: Auggie `~/.augment/commands/` (nested namespaces preserved as `/namespace:command`; project `.augment/commands/`) and Nanocoder `~/.config/nanocoder/commands/` (nested `:`-separated namespaces preserved; directory-as-command bundles export their markdown with a warning that `resources/` files are not migrated; project `.nanocoder/commands/`). Client-specific frontmatter and argument placeholders are copied as-is with a warning.
