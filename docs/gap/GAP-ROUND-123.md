# GAP-ROUND-123: GitHub Copilot CLI custom commands (`.claude/commands/`)

## What shipped

Project-scoped commands support for the `copilot` adapter:

- `agentmove export copilot --project <dir>` reads `.claude/commands/**/*.md`
  recursively (byte-faithful, nested names preserved).
- `agentmove import copilot --project <dir>` writes commands to
  `.claude/commands/` — the Claude-compatible directory Copilot CLI reads.
- Nested names (`git/commit`) are written as nested paths for Claude Code
  compatibility, with a per-command warning that Copilot documents only
  single-file commands and may not discover them.
- User-scope imports with commands keep the generic skip warning: Copilot CLI
  has no user-level commands root.

## Evidence

- Copilot CLI official changelog (`changelog.json` inside
  `@github/copilot-linux-x64@1.0.78`, also on the GitHub releases page):
  - `0.0.399`: "Support `.claude/commands/` single-file commands as simpler
    alternative to skills"
  - `1.0.36`: "Custom agents, skills, and commands from `~/.claude/` are no
    longer loaded by the Copilot CLI" — so there is **no user-level commands
    root** in current versions.
- Copilot SDK types (`sdk/index.d.ts` in the same package):
  `isCommand?: boolean` documented as "Whether this is a command (from
  .claude/commands/) rather than a skill."
- Official docs (docs.github.com "Adding agent skills for GitHub Copilot CLI",
  CLI command reference) document skills/instructions/plugins but not the
  Claude-compat commands directory — the changelog entries above are the
  authoritative source for the path.
- Community confirmation: github/copilot-cli issues #618 / #1113 report
  project `.claude/commands/*.md` files working as slash commands.

## Deferred / not migrated (recorded honestly)

- **Runtime verification**: Copilot CLI requires an authenticated Copilot
  subscription before it scans commands, so discovery details (recursion,
  `.prompt.md` handling, frontmatter parameter semantics) could not be
  verified empirically in this environment. Behavior beyond the changelog
  wording is warned, not assumed.
- **`.github/prompts/`**: maintainers state prompt files were superseded by
  skills; not a Copilot CLI commands root — stays with the VS Code adapter.
- **Copilot plugin-shipped commands** (`plugin.json` custom paths, 0.0.417):
  plugin internals are managed by `copilot plugin`; not migrated.
- **User-level commands**: none exists (1.0.36); user-scope imports skip with
  a warning rather than writing a directory Copilot no longer reads.
