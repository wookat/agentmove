---
"agentmove-cli": minor
---

Commands layer for Kilo Code and Cline: Kilo `~/.config/kilo/commands/` (flat; legacy `~/.kilocode/workflows/` still read, new location wins; project `.kilo/commands/`) and Cline workflows `~/Documents/Cline/Workflows/` (flat, `/name.md` invocation; non-markdown workflow files warned, not migrated; project `.clinerules/workflows/`). Nested bundle names are flattened with a warning; client-specific frontmatter is copied as-is with a warning.
