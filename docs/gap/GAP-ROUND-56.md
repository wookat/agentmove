# GAP Report — Round 56

## Improvement chosen

Add **Kilo Code** as the 32nd supported client.

## Why Kilo

- Kilo Code has one of the largest VS Code agent-extension install bases and
  now ships a CLI; since v7 the CLI, VS Code, and JetBrains surfaces all read
  the same `~/.config/kilo/` config files — one adapter covers all three.
- The config model is fully documented (an opencode-style `mcp` key with
  `type: local/remote`), plus a documented global AGENTS.md and an Agent
  Skills directory.

## Official sources

- https://kilo.ai/docs/features/mcp/using-mcp-in-cli — config locations
  (global `~/.config/kilo/kilo.json`, also `kilo.jsonc`/`config.json`;
  project `./kilo.json` or `./.kilo/kilo.json`), `mcp` key format:
  local (`command` argv array, `environment`, `enabled`, `timeout`) and
  remote (`url`, `headers`, `enabled`, `timeout`)
- https://kilo.ai/docs/getting-started/settings — JSONC config shared by
  CLI/VS Code/JetBrains; old globalStorage `mcp_settings.json` is legacy
  (ignored since v7.0.33 per Kilo-Org/kilocode#6481)
- https://kilo.ai/docs/customize/custom-instructions — global
  `~/.config/kilo/AGENTS.md`; project `AGENTS.md` (CLAUDE.md compatible)
- https://kilo.ai/docs/customize/skills — global `~/.kilo/skills/`,
  project `.kilo/skills/`, SKILL.md format (`.claude/skills` and
  `.agents/skills` also read for compatibility)

## Verified facts

- MCP servers live under the `mcp` key of the general config file — other
  keys must be preserved on rewrite; JSONC accepted (comments warned as not
  preserved on rewrite).
- Local entries: `type: "local"`, `command` as argv array, `environment`;
  remote entries: `type: "remote"`, `url`, `headers`. Native `enabled`
  boolean round-trips as the portable disabled flag.
- `timeout` is client-specific (warned, preserved on merge).
- `{env:VAR}` references in config values are left as-is.
- Global instructions: `~/.config/kilo/AGENTS.md`; project: root `AGENTS.md`.
- Skills: `~/.kilo/skills/` (global), `.kilo/skills/` (project) —
  agentskills.io standard.
- No durable memory store — memory skipped with a warning.

## Lossy edges (all warned)

- No `sse` type — SSE servers emitted as `remote`.
- `cwd` not supported — dropped.
- Persona has no native slot — appended to AGENTS.md (approximated).
- Memory — skipped.
- JSONC comments not preserved on rewrite.

## Deferred

- Legacy VS Code globalStorage `mcp_settings.json` (pre-v7 Kilo) — ignored
  by current Kilo itself; users on old versions should update first.
- `skills.paths`/`skills.urls` extra skill locations — client-specific
  runtime configuration, preserved as general config keys.
- Tool permissions (`allow`/`ask`/`deny`) — client-specific, preserved as
  general config keys.
