# GAP-ROUND-44 — Antigravity (Google) as the 22nd client

## Trigger / evidence

- Competitive/ecosystem scan: Google Antigravity (Antigravity 2.0, Antigravity
  IDE, Antigravity CLI) is Google's agent-first development environment and a
  major MCP host; AgentMove had no adapter for it.
- Official documentation used:
  - MCP: https://antigravity.google/docs/mcp — config file is
    `~/.gemini/config/mcp_config.json` globally or `.agents/mcp_config.json`
    per workspace, with a single `mcpServers` object. Explicit warning in the
    docs: remote SSE/Streamable-HTTP/websocket connections **must** use the
    `serverUrl` field; legacy `url`/`httpUrl` are not supported.
  - MCP entry properties (same page): `command`/`args`/`env`/`cwd` for stdio,
    `serverUrl`/`headers` for remote, plus `authProviderType`, `oauth`,
    `disabled`, `disabledTools`.
  - Skills: https://antigravity.google/docs/skills — global Agent Skills in
    `~/.gemini/config/skills/<name>/SKILL.md`, workspace skills in
    `.agents/skills/`.
  - Rules/workflows locations (verified independently, e.g.
    https://atamel.dev/posts/2026/07-13_where_agy_rules_workflows/): global
    rules in `~/.gemini/GEMINI.md`, workspace rules in `.agents/rules/`,
    workflows in `~/.gemini/config/global_workflows/` (client-specific; not
    migrated).

## Gap

AgentMove supported 21 clients; Antigravity was absent despite being a
first-party Google product sharing the `~/.gemini` directory with Gemini CLI.

## What shipped

- `antigravity` adapter (user scope):
  - `~/.gemini/config/mcp_config.json` `mcpServers` map read/write, merge by
    name, `--replace-mcp` supported, other root keys preserved.
  - `serverUrl` ↔ portable `url` normalization on both directions (imports
    always emit `serverUrl` for remote servers per the official warning).
  - Native `disabled: true` round-trips as portable `enabled: false`.
  - `disabledTools`, `authProviderType`, `oauth` reported as client-specific
    warnings and preserved on merge.
  - Agent Skills migrated through `~/.gemini/config/skills/`.
  - Instructions: global rules live in `~/.gemini/GEMINI.md`, which is shared
    with Gemini CLI — to avoid two adapters writing the same file, the
    user-scope instructions layer stays owned by the `gemini` client and
    antigravity emits an explicit warning instead.
  - Persona/memory: no native slots — warned and skipped.
- Project scope: `.agents/mcp_config.json` + `.agents/rules/*.md` (merged with
  source markers, falling back to `AGENTS.md` on export; imports write
  `.agents/rules/agentmove.md`) + `.agents/skills/`.
- Full matrix expanded to 22×22 in e2e; new fixture `antigravity-home`.
- Docs: README, website hero + clients page, man page updated.

## Known limitations (all warned)

- `disabledTools`/`authProviderType`/`oauth` are client-specific.
- Global rules (GEMINI.md) are handled via the `gemini` client at user scope.
- No durable memory store.
- Workflows (`.agents/workflows/`, `~/.gemini/config/global_workflows/`) are
  client-specific and not migrated.

## Verification

- 23 test files / 126 tests green; branch coverage 66.38% (gate 65%).
- Build, lint, typecheck, website build green.

## Data note

npm daily downloads (real, api.npmjs.org): 2026-08-04 = 131,
2026-08-05 = 1607; later days report 0 (registry lag). No adoption claims
beyond these observed values.
