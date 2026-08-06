---
"agentmove-cli": minor
---

Add Amazon Q Developer CLI as the 24th supported client: user-level MCP servers
in `~/.aws/amazonq/mcp.json` (`mcpServers` map, stdio/http with native
`disabled` flag; `timeout`/`oauth`/`oauthScopes` warned as client-specific; SSE
servers are written as `http` since the CLI has no `sse` type), and project
scope via `.amazonq/mcp.json` + `AmazonQ.md`. Agent JSON files (`cli-agents/`),
the app-managed `/knowledge` store, and skills have no Q CLI equivalent and are
skipped with warnings.
