---
"agentmove-cli": minor
---

New client: Cortex Code (Snowflake CoCo) — `cortex`. Migrates
`~/.snowflake/cortex/mcp.json` MCP servers (explicit `type: stdio/http/sse`,
stdio `command`/`args`/`env`/`cwd`, remote `url`/`headers`; the per-server
`timeout` is client-specific and warned), `~/.snowflake/cortex/AGENTS.md` user
instructions, and `~/.snowflake/cortex/skills/` Agent Skills. `--project`
covers `.cortex/mcp.json`, root `AGENTS.md`, and `.cortex/skills/`.
Agent-managed memory under `~/.snowflake/cortex/memory/` is honestly skipped
with a warning.
