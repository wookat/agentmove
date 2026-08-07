---
title: Package your agent as an Agent Plugin
description: Turn any supported client's skills and MCP servers into an Agent Plugins 1.0.0 package — or import any ecosystem plugin into 46 clients.
---

**Agent Plugins 1.0.0** launched on August 6, 2026 at
[agent-plugins.org](https://agent-plugins.org): an open, vendor-neutral standard
for packaging Agent Skills and MCP servers into portable plugins, maintained by
Core Maintainers from Amazon, Cursor, Google, Microsoft, OpenAI, and Vercel. At
launch it is supported across ChatGPT/Codex, Cursor, GitHub Copilot, Kiro, and
VS Code, with more clients adopting it.

AgentMove speaks the format in both directions since v0.48.0.

## Export any client as a plugin

```bash
npx agentmove-cli export claude-code --plugin -o my-plugin
```

This writes a conformant plugin instead of an agentmove bundle:

```text
my-plugin/
├── plugin.json     # $schema + name (from the output directory name)
├── mcp.json        # every server carries an explicit type
└── skills/
    └── review/
        └── SKILL.md
```

`mcp.json` always uses the explicit transport types the spec requires —
`stdio`, `streamable-http`, or `sse` — regardless of how the source client
spelled them:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "docs":   { "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-fetch"] },
    "remote": { "type": "streamable-http", "url": "https://example.com/mcp",
                "headers": { "Authorization": "${Authorization}" } }
  }
}
```

Likely secrets are redacted to `${VAR}` placeholders by default, exactly as in
bundle exports.

## Import any plugin into any client

`import -i` auto-detects a directory containing `plugin.json`, so a plugin from
anywhere in the ecosystem imports into any of the 46 supported clients:

```bash
# Preview first — nothing is written without --apply
npx agentmove-cli import codex -i some-plugin

# Apply it — existing files are backed up to ~/.agentmove/backups
npx agentmove-cli import codex -i some-plugin --apply
```

MCP servers merge by name into the target's config (use `--replace-mcp` to
replace), and skills land in the target's skills directory byte-for-byte.

## Honest edges

The plugin format covers two of AgentMove's five layers. Everything else is
warned about, never dropped silently:

- **instructions / persona / memory** have no plugin component — exported
  plugins omit them with a warning (use a bundle, or `--mif` for memory).
- An absolute MCP `cwd` is dropped with a warning: the spec only allows
  plugin-relative (`./…`) or `${PLUGIN_ROOT}`/`${PLUGIN_DATA}` working
  directories.
- `enabled: false` has no plugin representation — the server is exported
  enabled, with a warning.
- On import, entries missing the required explicit `type` (or using an unknown
  type such as `websocket`) are dropped with a warning, per the spec's
  validation rules.
