---
"agentmove-cli": minor
---

New client: Claude Desktop (`claude-desktop`). Migrates MCP servers from
`claude_desktop_config.json`, checking all three platform locations
(`~/Library/Application Support/Claude` on macOS, `%APPDATA%\Claude` on
Windows, `~/.config/Claude` on Linux) and writing back to the existing file
or the current platform's default. Instructions, memory, and projects are
app-managed in Claude Desktop and are skipped with warnings.
