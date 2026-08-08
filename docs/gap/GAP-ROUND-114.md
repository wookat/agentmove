# GAP-ROUND-114: commands layer for goose (recipes)

## Decision

Add the commands layer to goose by converting between portable markdown
commands and goose **recipes**, and register imported commands as
`slash_commands` in `~/.config/goose/config.yaml` so they are invokable as
`/name`.

## Evidence

Official goose documentation (block.github.io/goose, sources in
`block/goose` `documentation/docs/guides/`):

- Custom Slash Commands (`context-engineering/slash-commands.md`): custom
  slash commands run recipes; the CLI registers them in
  `~/.config/goose/config.yaml` under `slash_commands:` with
  `command` + `recipe_path` entries. Limitations: at most one parameter,
  case-insensitive names, no clash with built-in commands.
- Saving Recipes (`recipes/storing-recipes.md`): global recipe library is
  `~/.config/goose/recipes/`; local project recipes are
  `<project>/.goose/recipes/`. The CLI saves recipes as `.yaml`; it can run
  `.json` but not `.yml` ("the CLI only supports `.yaml` and `.json`").
- Recipe Reference (`recipes/recipe-reference.md`): recipe schema —
  `version`, `title`, `description` (required), `instructions`/`prompt`
  (at least one required), plus recipe-only fields `parameters`,
  `extensions`, `settings`, `activities`, `response`, `sub_recipes`, `retry`.
- Config file reference (`config-files.md`): `slash_commands` schema with
  `command` and `recipe_path`.

goose source (`block/goose`, `crates/goose/src/recipe/local_recipes.rs`):
`scan_directory_for_recipes` uses a non-recursive `fs::read_dir` and accepts
only `RECIPE_FILE_EXTENSIONS` (`yaml`, `json`) — so recipe discovery is a
**flat scan**, and nested command names are flattened on import (warned).

## Conversion model (documented, lossy where unavoidable)

- Export: `title` (when it differs from the filename) and `description`
  become one-line frontmatter; `prompt`/`instructions` become the markdown
  body (when both exist they are concatenated with a warning). Recipe-only
  fields are dropped with a per-field warning. Recipes without
  `prompt`/`instructions`, invalid files, and `.yml` files are not migrated
  (warned per file).
- Import: the body becomes the recipe `prompt`; `title` falls back to the
  (flattened) command name and `description` to an "Imported by agentmove"
  line, since both are required recipe fields. Frontmatter with fields
  beyond `title`/`description` is kept verbatim inside `prompt` (warned).
  A `slash_commands` entry pointing at the written recipe is merged into
  `config.yaml` (case-insensitive by command name; re-pointing an existing
  command warns).
- Project scope: `.goose/recipes/` is written; the user-level `config.yaml`
  is not touched (warned) — project recipes remain discoverable via
  `goose recipe list`.

## Deferred (with evidence)

- **GOOSE_RECIPE_PATH / GitHub recipe repositories**: additional discovery
  sources are environment- or remote-configured, not user files under HOME —
  not migrated.
- **Recipe deeplinks and the Desktop Recipe Library**: app-managed, not
  files — not migrated.
- **Recipe-only fields** (`parameters`, `extensions`, `settings`,
  `sub_recipes`, `response`, `retry`, `activities`): no portable command
  equivalent; dropped with explicit per-field warnings rather than silently.
- **GitHub Copilot CLI `.claude/commands/` support** (release v0.0.399
  "Support `.claude/commands/` single-file commands"): the root belongs to
  the Claude Code adapter; duplicating it under the copilot adapter would
  double-read/write the same files. Deferred pending a documented
  copilot-owned commands root.
