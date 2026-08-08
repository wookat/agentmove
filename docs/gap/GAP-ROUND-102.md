# GAP ROUND-102: portable commands / custom prompts layer

## Gap

Multiple clients ship a Markdown "slash command / reusable prompt" mechanism
that is distinct from Agent Skills and custom agents, but AgentMove had no
normalized representation for it — switching clients meant manually copying
command files.

## Research (official docs)

- **Claude Code** — project commands in `.claude/commands/<name>.md`, personal
  commands in `~/.claude/commands/`; subdirectories create namespaced commands
  (`.claude/commands/git/commit.md` → `/git:commit`); frontmatter supports
  `allowed-tools`, `argument-hint`, `description`, `model`; `$ARGUMENTS`/`$1`
  placeholders. Docs note skills supersede commands sharing a name, but
  commands remain fully supported.
  https://docs.claude.com/en/docs/claude-code/slash-commands
- **Codex CLI** — custom prompts in `~/.codex/prompts/<name>.md` (top-level
  files only, user scope only), invoked as `/prompts:<name>`; frontmatter
  supports `description` and `argument-hint`; deprecated in favor of skills
  but still supported.
  https://developers.openai.com/codex/custom-prompts/
- **Cursor** — commands in `.cursor/commands/<name>.md` (project) and
  `~/.cursor/commands/` (user); plain Markdown, filename is the command name.
  https://cursor.com/docs/agent/chat/commands
- **Windsurf** — workflows in `.windsurf/workflows/` are project-scoped,
  manual-only procedures with their own discovery semantics (parent
  directories up to the git root); **deferred** — not a clean fit for a
  byte-faithful commands layer this round.
- **OpenHands** — microagents are keyword-triggered context, closer to rules
  than commands; **not mapped**.

## Decision

Add a normalized `commands` layer (`CommandDef { name, content }`, names may
contain `/` for namespaced commands) supported by:

- claude-code: `~/.claude/commands/` (recursive, nested names preserved) +
  project `.claude/commands/`
- cursor: `~/.cursor/commands/` (flat) + project `.cursor/commands/`
- codex: `~/.codex/prompts/` (flat, user scope only, deprecation noted)

Semantics:

- content is byte-faithful; frontmatter/argument placeholders warned as
  client-specific
- flat-scan targets (cursor, codex) flatten nested names `git/commit` →
  `git-commit` with a warning; post-flatten collisions skip with a warning
- bundles store commands under `commands/<name>.md` (nested dirs supported);
  old bundles without a `commands/` directory read as an empty layer
- `--only commands`, `diff`, `doctor` inventory, and JSON summaries updated
- all other clients: honest "no custom commands directory; skipped" warning
