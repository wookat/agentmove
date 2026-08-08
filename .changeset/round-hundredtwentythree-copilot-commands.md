---
"agentmove-cli": minor
---

Commands layer for GitHub Copilot CLI (project scope): `--project` export reads Claude-compatible `.claude/commands/**/*.md` single-file commands (byte-faithful, nested names preserved) and import writes them back to `.claude/commands/`. Copilot documents only single-file commands (changelog 0.0.399) and no longer loads `~/.claude/` (1.0.36), so nested imports carry a per-command discovery warning and user-scope imports keep skipping commands with a warning.
