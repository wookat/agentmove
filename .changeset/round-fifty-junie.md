---
"agentmove-cli": minor
---

Add Junie (JetBrains) as the 26th supported client: user-level MCP servers in
`~/.junie/mcp/mcp.json` (`mcpServers`; entries have no `type` field — stdio
uses `command`/`args`/`env`, remote uses `url`/`headers`; no `disabled` flag,
warned), global guidelines in `~/.junie/AGENTS.md`, and `~/.junie/skills/`
(Agent Skills standard). Project scope covers `.junie/mcp/mcp.json`,
`.junie/AGENTS.md` (root `AGENTS.md` and legacy `.junie/guidelines.md` are
read), and `.junie/skills/`. The same files are shared by the JetBrains IDE
plugin and Junie CLI.
