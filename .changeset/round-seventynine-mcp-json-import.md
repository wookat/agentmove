---
"agentmove-cli": minor
---

Standalone MCP config import: `import <client> -i mcp.json` now accepts any bare `.json` file with an `mcpServers` map (an Agent Plugins mcp.json, a Claude-style .mcp.json, or a canonical team server list) and merges it into any client. Transports come from an explicit `type`/`transport` field or are inferred from `command`/`url` with a warning; unresolvable entries are dropped with a warning.
