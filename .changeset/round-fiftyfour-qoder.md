---
"agentmove-cli": minor
---

Add Qoder CLI (Alibaba) as the 30th supported client. User scope migrates the
`mcpServers` key inside `~/.qoder/settings.json` (other settings preserved on
rewrite; explicit `type` written on import; native `ws` servers are skipped
with a warning), `~/.qoder/AGENTS.md` user memory as instructions, and
`~/.qoder/skills/` Agent Skills. `--project` covers `.mcp.json` at the project
root, `AGENTS.md`, and `.qoder/skills/`.
