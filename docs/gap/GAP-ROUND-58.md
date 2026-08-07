# GAP-ROUND-58: Grok CLI (xAI Grok Build) — 34th client

## Selection rationale

- First-party coding agent from xAI ("Grok Build" / `grok` CLI), recently
  open-sourced (github.com/xai-org/grok-build) with an active changelog and a
  full extension surface (MCP servers, AGENTS.md rules, Agent Skills,
  plugins, hooks).
- Uses the AGENTS.md standard and the SKILL.md Agent Skills standard, so
  instructions and skills migrate natively.
- Grok itself ships compat loaders for `~/.claude.json`, `.cursor/mcp.json`,
  and project `.mcp.json` — clear evidence users move between these
  ecosystems, which is exactly agentmove's use case.

## Official sources

- MCP servers: https://docs.x.ai/build/features/mcp-servers
- Project rules (AGENTS.md): https://docs.x.ai/build/features/project-rules
- Skills/plugins/marketplaces: https://docs.x.ai/build/features/skills-plugins-marketplaces
- CLI reference: https://docs.x.ai/build/cli/reference
- Source: https://github.com/xai-org/grok-build

## Verified behavior

- User MCP config: `~/.grok/config.toml`, `[mcp_servers.<name>]` tables.
  Stdio: `command` + `args` + `env`. Remote: `url` + `headers` (no explicit
  transport field). `startup_timeout_sec` / `tool_timeout_sec` are
  client-specific (warned; preserved on merge because unrelated keys are
  retained). `${VAR}` (and `${VAR:-default}`) expand from the environment at
  load time — agentmove's redaction placeholders are natively usable.
- Global rules: markdown files in `~/.grok/` (AGENTS.md standard). agentmove
  reads/writes `~/.grok/AGENTS.md`.
- Skills: `~/.grok/skills/<name>/SKILL.md` (user), `.grok/skills/` (project).
- Project scope: `.grok/config.toml` (written by `grok mcp add --scope
  project`), root `AGENTS.md`, `.grok/skills/`.

## Lossy edges (all warned)

- No documented `sse` transport — SSE servers emitted as plain `url`.
- `cwd` not documented for stdio servers — dropped.
- No documented per-server disabled flag in `config.toml` (the changelog adds
  `grok mcp enable/disable`, but the persisted field is undocumented) —
  disabled servers imported as enabled with a pointer to `grok mcp disable`.
- No durable memory store — memory skipped (use `--mif`).
- Persona appended to `~/.grok/AGENTS.md` (approximated).

## Deferred

- `GROK_HOME` relocation of the config directory.
- Compat-loaded MCP sources (`~/.claude.json`, `.cursor/mcp.json`, project
  `.mcp.json`) — those belong to their own clients and are already covered by
  the claude-code/cursor adapters; duplicating them under grok would double
  migration.
- `.grok/rules/` per-directory rule trees and nested AGENTS.md files.
- Plugins, hooks, agent profiles, marketplaces — grok-internal.
- OAuth MCP credentials (`~/.grok/mcp_credentials.json`) — machine-private
  tokens, intentionally never migrated.
