# GAP-ROUND-108: commands layer for Auggie CLI and Nanocoder

## Auggie CLI (Augment Code)

Official docs:

- https://docs.augmentcode.com/cli/custom-commands
- https://docs.augmentcode.com/cli/custom-commands-examples

Behavior:

- User commands: `~/.augment/commands/*.md`; workspace commands: `.augment/commands/*.md`.
- Subdirectories are namespaces: `.augment/commands/frontend/component.md` -> `/frontend:component`, so nested bundle names are preserved on import.
- Frontmatter (`description`, `argument-hint`) and `$ARGUMENTS` placeholders are client-specific; copied as-is with a warning.
- Auggie also reads `~/.claude/commands/` and `~/.agents/commands/` (and their project equivalents) for compatibility. Those roots are owned by the claude-code and shared-agents adapters; the auggie adapter neither reads nor writes them to avoid double ownership.

## Nanocoder (Nano Collective)

Source (verified against the nanocoder repository, `source/custom-commands/loader.ts` and `source/config/paths.ts`):

- Personal commands: `<config>/nanocoder/commands/` where `<config>` is `~/.config` on Linux (`NANOCODER_CONFIG_DIR` override, platform-specific elsewhere); project commands: `.nanocoder/commands/` (project wins on name conflicts).
- Recursive scan; subdirectories become `:`-separated namespaces.
- Directory-as-command: a directory containing `<dirname>.md` is a single command (not a namespace) with optional `resources/` files. AgentMove exports the command markdown and warns that `resources/` files are client-specific and not migrated.
- Frontmatter (`description`, `aliases`, `triggers`, `tags`) and `{{parameter}}` template placeholders are client-specific; copied as-is with a warning.

## Deferred

- Kimi plugin commands, Gemini CLI TOML commands, Copilot CLI prompts, and Trae remain deferred (no portable markdown command directory documented) — unchanged from GAP-ROUND-107.
- Nanocoder skill-bundle commands (`.nanocoder/skills/<name>/commands/`) are part of nanocoder's own skill.yaml bundle format and are not migrated.
