# GAP ROUND-105 — commands layer: CodeBuddy + Droid

## Research

### CodeBuddy custom slash commands — SUPPORTED (this round)

- Official docs: https://www.codebuddy.ai/docs/cli/slash-commands and
  https://www.codebuddy.ai/docs/cli/codebuddy-dir
- Paths: `~/.codebuddy/commands/` (personal global), `.codebuddy/commands/`
  (project). Markdown files; a `test.md` file registers as `/test`.
- Nested subdirectories are supported and become colon-namespaced names:
  `commands/team/deploy.md` → `/team:deploy`. AgentMove preserves the nested
  layout on both export and import (same treatment as Claude Code namespaces).
- Frontmatter: `description`, `argument-hint`, `model`, `allowed-tools`,
  `disable-model-invocation`; `$ARGUMENTS` argument placeholder. Copied as-is
  with a client-specific warning.

### Droid (Factory) custom slash commands — SUPPORTED (this round)

- Official docs: https://docs.factory.ai/harness/custom-slash-commands
- Paths: `~/.factory/commands/` (personal), `.factory/commands/` (workspace;
  workspace overrides personal on slug conflicts). Discovered recursively.
- Registered files: `.md` markdown prompts OR files whose first line is a
  `#!` shebang (executable script commands). Only markdown commands are
  migrated; script commands get a per-file warning on export (shell scripts,
  not portable prompts).
- Filenames are slugged by the client (lowercased, spaces/non-URL chars → `-`,
  extension dropped) — noted in the import warning; contents copied as-is.
- Factory recommends Skills for new workflows; `.factory/commands` files keep
  working, so the mapping is honest and current.

## Deferred / rejected

- **Gemini CLI commands** (`~/.gemini/commands/`, `.gemini/commands/`): still
  TOML-only; converting markdown commands to TOML would not be byte-faithful.
  Unchanged from ROUND-103/104.
- **Kilo Code workflows/commands**: docs describe `.kilo/commands/` +
  `~/.config/kilo/commands/` for the new extension with auto-migration from
  legacy `.kilocode/workflows/`; the ecosystem is mid-migration (docs, GitHub
  issues and the opencode-based rewrite disagree on canonical paths). Deferred
  until the layout stabilizes.
- **Copilot CLI prompts**: still no documented user-level commands/prompts
  directory. Unchanged.
