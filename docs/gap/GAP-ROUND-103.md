# GAP ROUND 103 — commands layer for OpenCode and Qwen Code

## Research

Round 102 introduced the portable commands layer (Claude Code, Cursor,
Codex). This round extends it to the two remaining markdown-native
command ecosystems:

- **OpenCode** — official docs (https://opencode.ai/docs/commands/):
  markdown command files in `~/.config/opencode/commands/` (global) and
  `.opencode/commands/` (project). Files may be nested; `team/review.md`
  defines `/team/review`. Frontmatter supports `description`, `agent`,
  `model` (client-specific). JSON-config commands share one registry with
  markdown files but live in `opencode.json` — not migrated as commands.
- **Qwen Code** — official docs
  (https://qwenlm.github.io/qwen-code-docs/en/users/features/commands/):
  markdown commands in `~/.qwen/commands/` (global) and
  `.qwen/commands/` (project); subdirectories become `/git:commit`-style
  namespaced names. The legacy TOML format is **deprecated** (removal
  planned; the CLI shows a migration prompt) — TOML files are not
  migrated, each is warned on export.

## Decision

- Add `supportsCommands: true` to the `opencode` and `qwen` adapters and
  their project adapters, using the recursive reader so nested names are
  preserved byte-faithfully.
- Warn on client-specific frontmatter/argument placeholders as elsewhere
  (`{{args}}`, `!{...}`, `@{...}` for qwen; `agent:`/`model:` for
  opencode).
- Warn per deprecated qwen `.toml` command on export instead of silently
  ignoring or attempting a lossy TOML→markdown conversion.

## Deferred

- **Gemini CLI** custom commands are TOML-only (`prompt`/`description`
  fields) — mapping markdown command bodies into TOML prompt strings is a
  format conversion, not a byte-faithful copy; deferred until a clean
  lossy-conversion policy is decided.
- **Windsurf workflows** remain deferred (see GAP-ROUND-102).
