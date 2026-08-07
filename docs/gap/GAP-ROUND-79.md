# GAP ROUND-79 — standalone mcp.json import (competitor-driven)

## Trigger (competitor research)

`mcp-sync` (justinclayton/mcp-sync) markets exactly one workflow: "Write your
MCP config once, install it everywhere" — a canonical `mcp.json` synced into
Claude Code, Cursor, Copilot, Windsurf, and OpenCode. That validates a real
user demand AgentMove did not cover: users often have a bare `mcpServers` file
(a team's canonical list, a Claude-style `.mcp.json`, or since ROUND-77 an
Agent Plugins `mcp.json` on its own) and want it in a client without first
wrapping it in a bundle or plugin.

AgentMove already had the harder parts (46 client adapters, merge-by-name,
dry-run, backups, redaction); the gap was only input detection.

## What this round ships

- `import <client> -i <file>.json` — auto-detected standalone MCP config
  import. Detection: an existing regular file ending in `.json` (checked after
  MIF/agentpack/plugin-dir, before bundle). A `.json` file without `mcpServers`
  is a data error (exit 3).
- Lenient transport resolution (`parseMcpEntries` with `inferType: true`),
  shared with the plugin reader: explicit `type` or `transport` field
  (`stdio` / `streamable-http` / `streamable_http` / `streamable` / `http` /
  `sse`); when omitted, `command` ⇒ stdio and `url` ⇒ streamable-http, each
  with an explicit "inferred" warning. Unresolvable entries are dropped with a
  warning. The Agent Plugins reader stays strict (explicit type required) per
  the spec's validation rules.

## Comparison with mcp-sync

- mcp-sync: 5 harnesses, sync/remove per server, URL sources.
- AgentMove: 46 clients, layers beyond MCP, dry-run default, automatic
  backups, redaction, merge or `--replace-mcp`. Per-server selection is
  possible today via `--only mcp` + editing the file; URL input is out of
  scope this round (a local file is the common case; `curl | tee` covers it).
