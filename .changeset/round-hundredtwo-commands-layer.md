---
"agentmove-cli": minor
---

New portable "commands" layer: migrate Markdown slash commands / custom prompts between Claude Code (`~/.claude/commands/`, nested names preserved; project `.claude/commands/`), Cursor (`~/.cursor/commands/`; project `.cursor/commands/`), and Codex CLI (`~/.codex/prompts/`, deprecated in favor of skills but still supported). Content is byte-faithful; client-specific frontmatter and argument placeholders are warned; flat-scan targets flatten nested names with a warning; `--only commands`, `diff`, and `doctor` support included.
