# GAP-ROUND-111: commands layer for Crush (Charm)

## Evidence

- Crush custom-commands doc (authored by the Crush team, referenced from
  https://github.com/charmbracelet/crush/discussions/1435 and
  https://github.com/charmbracelet/crush/issues/2219):
  https://github.com/charmbracelet/crush/blob/99edcbf1c17dbb1d74dc1a3f03a5e30bcfc58b39/COMMANDS.md
- Loader source: `internal/commands/commands.go` on `charmbracelet/crush`
  main — `buildCommandSources` reads three roots:
  1. `$XDG_CONFIG_HOME/crush/commands/` (user, `user:` prefix)
  2. `~/.crush/commands/` (user, `user:` prefix)
  3. `<DataDirectory>/commands/` (project, `project:` prefix);
  `DataDirectory` defaults to `.crush` in the project
  (`internal/config/config.go`: `defaultDataDirectory = ".crush"`).
- Discovery is recursive (`filepath.WalkDir`); only markdown files
  (`.md`, case-insensitive) are loaded. Subdirectory paths become `:`
  namespaces in the command ID (`git/commit.md` → `user:git:commit`), same
  nested-name model as claude-code.
- File content is used verbatim as the prompt — Crush does not parse YAML
  frontmatter. Named arguments use `$NAME` placeholders (uppercase letters,
  digits, underscores, starting with a letter); Crush prompts for values at
  invocation time.

## Decision

- **Export:** merge both user roots recursively with nested names preserved;
  the XDG root (`~/.config/crush/commands/`, the primary config root the
  existing adapter already uses) wins on name conflicts, with a warning when
  the secondary `~/.crush/commands/` root contributed files. Files are copied
  byte-faithfully. A bundle-level warning notes that `$NAME` argument
  placeholders are client-specific.
- **Import:** commands are written only to `~/.config/crush/commands/`
  (nested names preserved — Crush scans recursively). The secondary
  `~/.crush/commands/` root is never written, so a command doesn't end up
  duplicated across user roots. A warning notes frontmatter and argument
  placeholders from other clients are copied as-is.
- **Project scope:** `.crush/commands/` (the default `DataDirectory`),
  recursive, byte-faithful both ways.

## Deferred / not migrated

- **MCP prompts** surfaced in the command palette come from live MCP servers
  (`LoadMCPPrompts`), not files; never migrated.
- A user-set custom `data_directory` in crush.json can move the project
  commands root; agentmove reads/writes the default `.crush/commands/` only.
