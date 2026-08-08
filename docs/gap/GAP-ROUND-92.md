# GAP ROUND-92 — Cortex Code (Snowflake) adapter (47th client)

## Research signals

- Snowflake's Cortex Code ("CoCo") is a full agentic CLI + Desktop with
  official public documentation (docs.snowflake.com/en/user-guide/cortex-code/)
  covering settings, MCP, skills, memory, and instruction files.
- The GitHub CLI `gh skill` agent registry lists Cortex Code
  (`cortex`, user skills at `~/.snowflake/cortex/skills`, project skills at
  `.cortex/skills`) — confirming ecosystem adoption of the Agent Skills
  standard by this client.
- Candidate iFlow CLI re-checked and re-rejected (service shut down
  2026-04-17, see GAP-ROUND-53/54). Replit exposes an MCP *server*, not a
  local coding-agent config surface — nothing to migrate. Amp/Kimi/Kilo skills
  paths were re-audited against current docs; our adapters match (Amp reads
  `~/.agents/skills`, which Amp still honors alongside
  `~/.config/agents/skills`).

## Verified facts (official Snowflake docs)

- MCP servers: `~/.snowflake/cortex/mcp.json`, top-level `mcpServers` key.
  Fields: `type` (required, `stdio`/`http`/`sse`), `command`/`args`/`cwd`/`env`
  for stdio, `url`/`headers` for remote, per-server `timeout` (ms,
  client-specific). `env`/`headers` values may be migrated to the OS keychain
  by CoCo on first use — we still read/write the file form.
- Instructions: user scope `~/.snowflake/cortex/AGENTS.md` (the same file the
  Desktop "Custom instructions" editor writes); project scope root `AGENTS.md`.
- Skills: user/global `~/.snowflake/cortex/skills/`, project `.cortex/skills/`
  (Agent Skills SKILL.md standard; `.claude/skills` also read for compat).
- Memory: `~/.snowflake/cortex/memory/` — `MEMORY.md` index + topic files,
  agent-managed with UI reset controls. Not migrated; honest warning
  (`--mif` suggested), consistent with other agent-managed memory stores.
- Project MCP: workspace scope `.cortex/mcp.json` (or
  `<workspace>/.snowflake/cortex/mcp.json`; we use the `.cortex/` form).

## Decisions

- Explicit `type` written on every imported entry (docs mark it required).
- No per-server disabled flag documented → `enabled: false` imports as enabled
  with a warning.
- `timeout` warned as client-specific on export, preserved on merge.
- Hooks/permissions/agents/commands under `~/.snowflake/cortex/` are
  client-specific and untouched.

## Deferred

- Keychain-migrated secrets (CoCo moves `env`/`headers` values into the OS
  keychain after first use) cannot be exported once migrated — nothing in the
  file to read; inherent client behavior, documented here.
- `.claude/skills` compat locations are already covered by the claude-code
  adapter; no cross-wiring needed.
