# GAP-ROUND-50 — Junie adapter (26th client)

## Research trigger

Competitor/ecosystem scan after 0.23.0 (Warp). Junie is JetBrains' AI coding
agent (IDE plugin across IntelliJ/PyCharm/WebStorm/etc. plus a standalone
CLI) — a very large installed base with a documented file-based MCP/skills
setup, making it a high-value migration target.

## Official format (verified sources)

- junie.jetbrains.com/docs/junie-cli-mcp-configuration.html: MCP configs in
  `.junie/mcp/mcp.json` (project) and `~/.junie/mcp/mcp.json` (user); the
  `mcpServers` key with stdio `command`/`args`/`env` and remote
  `url`/`headers` entries (no `type` field documented). Servers added to
  `mcp.json` are enabled by default; enable/disable happens via the `/mcp`
  UI, not a JSON flag.
- junie.jetbrains.com/docs/guidelines-and-memory.html: guidelines discovery
  order is `.junie/AGENTS.md` → root `AGENTS.md` → legacy
  `.junie/guidelines.md` / `.junie/guidelines/`; global guidelines live in
  `~/.junie/AGENTS.md` (project guidelines take precedence on conflict).
- Junie plugin changelog (plugins.jetbrains.com/plugin/26104): Agent Skills
  supported — `.junie/skills/<name>/SKILL.md` (project) and
  `~/.junie/skills/` (user).
- JetBrains PhpStorm blog (2025-09) and third-party integration docs agree on
  the `~/.junie/mcp/mcp.json` user path shared by IDE plugin and CLI.

## Implementation

- `junie` client (user level): `~/.junie/mcp/mcp.json` (`mcpServers`, common
  entry shape, rendered without `type`), `~/.junie/AGENTS.md` instructions
  (persona appended as approximation), `~/.junie/skills/` Agent Skills.
  No `disabled` flag (warned); imported SSE servers written as plain `url`
  entries (warned); memory skipped (warned).
- Project scope: `.junie/mcp/mcp.json` + `.junie/AGENTS.md` (reads root
  `AGENTS.md` and legacy `.junie/guidelines.md`) + `.junie/skills/`.
- 26×26 conversion matrix + round-trip e2e; fixture `junie-home`.

## Gaps / deferred

- Junie CLI `~/.junie/config.json` hooks and custom subagents
  (`.junie/agents/*.md`) are Junie-specific concepts with no portable
  equivalent — not migrated.
- Server enable/disable state is app-managed (via `/mcp`), not in `mcp.json`.

## Data note

Real npm downloads (api.npmjs.org, last-week at time of writing):
08-04 = 131, 08-05 = 1607, earlier days 0. No adoption claims beyond the raw
numbers.

## Verification

- `pnpm build`, `pnpm -w lint`, typecheck green.
- Full suite: 28 test files / 145 tests green; coverage above the 65% branch gate (docs-sync guard forced the
  README/website/man updates in this round).
- Website build green.
