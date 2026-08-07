---
"agentmove-cli": minor
---

New client: JetBrains AI Assistant (`jetbrains`, 43rd client) — user-scoped MCP servers in the shared `~/.ai/mcp/mcp.json` (`mcpServers`; native `workingDirectory` round-trips as `cwd`), project scope `.ai/mcp/mcp.json` + `.aiassistant/rules/*.md` project rules. Prompts and chat memory are IDE-managed (skipped with warnings).
