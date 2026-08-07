---
"agentmove-cli": minor
---

Add Kimi Code CLI (Moonshot AI) as the 33rd supported client. User scope
migrates the `mcpServers` key of `~/.kimi-code/mcp.json` (stdio uses
`command`/`args`/`env`/`cwd`, HTTP uses a plain `url` with optional
`headers`, legacy SSE sets `transport: "sse"`; native `enabled` flag
round-trips; `bearerTokenEnvVar`/`startupTimeoutMs`/`toolTimeoutMs`/
`enabledTools`/`disabledTools` are client-specific and warned),
`~/.kimi-code/AGENTS.md` global instructions, and `~/.kimi-code/skills/`
Agent Skills. `--project` covers `.kimi-code/mcp.json`, root `AGENTS.md`,
and `.kimi-code/skills/`.
