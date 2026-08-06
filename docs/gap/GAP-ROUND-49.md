# GAP-ROUND-49 — Warp adapter (25th client)

## Research trigger

Competitor/ecosystem scan after 0.22.0 (Amazon Q). Warp (warp.dev) has grown
from a terminal into an "agent platform" with first-class MCP support and is a
high-value migration target; users moving between Warp and CLI agents
currently re-enter MCP configs by hand.

## Official format (verified sources)

- Warp bundled skill `resources/bundled/skills/add-mcp-server/SKILL.md`
  (github.com/warpdotdev/Warp): global config `~/.warp/.mcp.json`,
  project-scoped `{repo_root}/.warp/.mcp.json`.
- Recognized wrapper keys (in order of preference): `mcpServers` (preferred),
  `mcp_servers`, `servers` — existing wrapper key must be preserved on write.
- Entries have **no `type` field**: stdio servers use `command`/`args`/`env`
  plus optional `working_directory` (defaults to the config's discovery dir);
  url servers use `url` with HTTP/SSE transport auto-negotiated.
- Warp GitHub issue #8613 / `app/src/ai/mcp/` source layout: Warp also detects
  third-party configs (Claude `.mcp.json`, Codex `config.toml`) — those are
  covered by our existing adapters; the Warp-native path is `.warp/.mcp.json`.
- docs.warp.dev/agents/capabilities/rules: project rules are `AGENTS.md`
  (or legacy `WARP.md`) at the repo root; global rules live in Warp Drive
  (app-managed, not a user file).

## Implementation

- `warp` client (user level): `~/.warp/.mcp.json`, wrapper-key detection and
  preservation, `working_directory` ↔ portable `cwd`, no `type` written,
  no `disabled` flag (warned), sse imports written as plain `url` entries
  (warned: transport auto-negotiated). Instructions/persona/memory/skills
  skipped with warnings (Warp Drive / app-bundled).
- Project scope: `.warp/.mcp.json` + `AGENTS.md` (reads legacy `WARP.md`).
- 25×25 conversion matrix + round-trip e2e; fixture `warp-home`.

## Gaps / deferred

- Warp Drive global rules and app-bundled skills are app-managed — not
  migratable as files; honestly warned.
- Warp's detection of third-party configs means a Warp user may effectively
  already share Claude/Codex configs; no double-write is done.

## Verification

- `pnpm build`, `pnpm -w lint`, typecheck green.
- Full suite: 27 test files / 141 tests green; coverage above the 65% branch
  gate.
- Website build green.
