# GAP ROUND-80 — standalone mcp.json export (`export --mcp-json`)

## Driver

ROUND-79 shipped standalone `mcp.json` **import** (`import <client> -i mcp.json`),
driven by mcp-sync's "one mcp.json installed into every client" model. The loop
was half-open: users could consume a canonical server list but not produce one.
Making a canonical list still required hand-writing JSON or shipping a whole
Agent Plugin directory (`export --plugin`) when only the MCP layer was wanted.

## What shipped

`export <client> --mcp-json <file>` (additive, like `--mif`):

- writes the bundle's MCP layer as a standalone standard `mcp.json`;
- explicit `type` on every entry (`stdio` / `streamable-http` / `sse`) —
  never the shape-guessing notation some clients use;
- stamped with the Agent Plugins MCP `$schema` for editor validation;
- secrets redacted to `${VAR}` placeholders by default (`--include-secrets`
  keeps literals), so the file is safe to commit/share;
- unlike a plugin's `mcp.json`, keeps `cwd` (a standalone file is not bound by
  the plugin-root containment rule; our importer round-trips it);
- `enabled: false` exported as enabled with a warning (format has no flag);
- works with `--json` (`mcpJson` field) and `--project`.

Round-trip: `export X --mcp-json f.json` → `import Y -i f.json` is warning-free
(explicit types mean no inference warnings).

## Implementation

Extracted `toMcpEntries(servers, warnings, { keepCwd })` in `plugin.ts` shared
by `writePlugin` (keepCwd: false) and the new `writeMcpFile` (keepCwd: true).
CLI wires `--mcp-json <file>` on `export` next to `--mif`.

## Alternatives considered

- New top-level command (`agentmove mcp export`) — rejected: an export flag
  mirrors `--mif`/`--plugin` and keeps the CLI surface flat.
- Omitting `$schema` — rejected: the Agent Plugins MCP schema is exactly the
  shape we write and gives users editor validation for free.

## Competitor contrast

mcp-sync can push one mcp.json into ~5 harnesses but cannot *extract* a
canonical list from an existing client setup. AgentMove now closes the full
loop across 46 clients: client → canonical mcp.json → any client, with
redaction, dry-run, merge, and backups throughout.
