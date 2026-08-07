---
"agentmove-cli": minor
---

Standalone MCP config export: `export <client> --mcp-json <file>` also writes
the MCP layer as a standalone standard mcp.json (explicit `type` on every
entry, Agent Plugins MCP schema, secrets redacted by default) — the reverse of
`import -i mcp.json`, producing a shareable canonical server list for a team or
any mcpServers-speaking tool. Standalone files keep `cwd`; disabled servers are
exported as enabled with a warning.
