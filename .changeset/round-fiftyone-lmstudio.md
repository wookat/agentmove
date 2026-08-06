---
"agentmove-cli": minor
---

Add LM Studio as the 27th supported client: MCP servers in
`~/.lmstudio/mcp.json` (`mcpServers` map, Cursor-style notation — stdio uses
`command`/`args`/`env`, remote uses `url`/`headers`, no `type` field; no
`disabled` flag, warned). System prompts/presets, chats, and models are
app-managed and are skipped with warnings; no project scope.
