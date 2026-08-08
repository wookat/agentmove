# GAP-ROUND-112: commands layer for Trae (ByteDance)

## Evidence

- Official Trae IDE commands doc (international):
  https://docs.trae.ai/ide/slash-commands
  - Project commands: `.trae/commands/` — "Support up to three levels of
    nested directories"; deeper levels are explicitly "unreadable".
  - Global commands: macOS/Linux `~/.trae/commands`, Windows
    `%userprofile%/.trae/commands`.
  - Command files are markdown created as `{command_name}.md` with
    Name/Description fields above `---` and instructions below.
- Official Trae IDE commands doc (CN edition):
  https://docs.trae.cn/ide_slash-commands
  - Same layout, but the global root is `~/.trae-cn/commands` (the CN
    edition uses a `.trae-cn` home directory).
- TraeCode CLI slash commands doc: https://docs.trae.cn/cli_slash-commands
  - Project-only `.traecli/commands/` with frontmatter
    `description`/`argument-hint`/`tools`/`model` and `$ARGUMENTS`/`$N`/
    `` !`cmd` `` placeholders. No user-level directory is documented.

## Decision

- **User scope (Trae IDE):** read both global roots recursively —
  `~/.trae/commands/` (international) and `~/.trae-cn/commands/` (CN
  edition) — merge with the international root winning on name conflicts
  (warned when the CN root contributed). Content is copied byte-faithfully.
- **Import:** write only `~/.trae/commands/` (nested names preserved) so a
  command is not duplicated across edition roots. Frontmatter
  (name/description) and argument conventions from other clients are
  client-specific — warned. Commands nested deeper than the documented
  3-level limit are still written but warned as not recognized by Trae.
- **Project scope:** `.trae/commands/`, recursive, byte-faithful both ways,
  with the same 3-level depth warning on import.

## Deferred / not migrated

- **TraeCode CLI** (`traecli`) is a separate product whose commands live in
  the project-only `.traecli/commands/` directory; no user-level root is
  documented. Deferred until agentmove grows a traecli adapter or the CLI
  documents a global commands root.
- Built-in commands (`/plan`, `/spec`) are product features, not files.
