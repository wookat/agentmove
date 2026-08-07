# GAP Report — Round 55

## Improvement chosen

Add **Auggie CLI** (Augment Code) as the 31st supported client.

## Why Auggie

- Augment Code is a major enterprise coding-agent vendor; the Auggie CLI is
  its terminal agent with complete public documentation for configuration,
  MCP, rules, and skills — a natural next node in the migration graph.
- Candidate Cherry Studio was rejected this round: its MCP configuration is
  managed through the app's Settings UI/internal store, with no documented
  stable user-editable config file to read/write safely.

## Official sources

- https://docs.augmentcode.com/cli/config — settings file locations and the
  hierarchical settings model (managed / local project / project / user)
- https://docs.augmentcode.com/cli/integrations — `mcpServers` shapes in
  settings.json (`type` stdio|sse|http, `command`/`args`/`env`,
  `url`/`headers`), `auggie mcp add|list|remove`
- https://docs.augmentcode.com/cli/rules.md — rules precedence (CLAUDE.md,
  AGENTS.md, `.augment-guidelines`, workspace `.augment/rules/`, user
  `~/.augment/rules/`); user rules are always `always_apply`
- https://docs.augmentcode.com/cli/skills.md — agentskills.io SKILL.md
  directories in `.augment/skills/` (workspace or home)

## Verified facts

- User MCP servers live under the `mcpServers` key of
  `~/.augment/settings.json` — a general settings file whose other keys
  (theme, enableChatInputCompletions, …) must be preserved on rewrite.
- Project settings: `.augment/settings.json` (shared, committed);
  `.augment/settings.local.json` is personal/machine-private (auto-added to
  .gitignore) — not migrated by design.
- Entry shape: `type` optional (stdio default) with stdio/sse/http; stdio
  uses `command`/`args`/`env`; remote uses `url`/`headers`; `${workspaceFolder}`
  variable expansion supported (left as-is). No per-server disabled flag.
- User rules: `~/.augment/rules/**/*.md`, always applied, plain markdown —
  exported merged as instructions; imports land in
  `~/.augment/rules/agentmove.md`.
- Skills: `~/.augment/skills/{name}/SKILL.md` (home) and `.augment/skills/`
  (workspace) — agentskills.io standard, direct migration.
- Augment Memories are app-managed — skipped with a warning.

## Lossy edges (all warned)

- No disabled flag — portable `enabled: false` emitted as enabled.
- `cwd` undocumented — dropped.
- Multiple user rules files merged into one instructions document on export.
- Persona has no native slot — appended to rules/agentmove.md (approximated).
- Memory app-managed — skipped.

## Deferred

- Managed settings (`/etc/augment/settings.json`) — org-admin read-only,
  out of scope.
- `.augment/settings.local.json` — machine-private by design; not migrated.
- Subagents, tool permissions, plugins — client runtime configuration, out
  of scope for the portable bundle.
