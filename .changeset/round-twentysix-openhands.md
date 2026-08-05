---
"agentmove-cli": minor
---

New client: OpenHands (`openhands`). Migrates MCP servers via the `[mcp]`
section of `~/.openhands/config.toml` (transport-specific `stdio_servers`,
`shttp_servers`, and `sse_servers` lists; string-or-object remote entries;
Bearer Authorization headers mapped to `api_key`, other headers dropped with a
warning) and user microagents (`~/.openhands/microagents/*.md`) as the
instructions layer. `--project` migrates `.openhands/microagents/` and
`.openhands/skills/` (SKILL.md directories). Per-server `timeout` and
conversation state are not portable — warned.
