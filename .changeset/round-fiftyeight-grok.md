---
"agentmove-cli": minor
---

Add Grok CLI (xAI Grok Build) as the 34th supported client. User scope
migrates the `[mcp_servers.*]` tables of `~/.grok/config.toml` (stdio uses
`command`/`args`/`env`, remote uses `url`/`headers`; other config tables are
preserved on rewrite; `startup_timeout_sec`/`tool_timeout_sec` are
client-specific and warned), `~/.grok/AGENTS.md` global rules, and
`~/.grok/skills/` Agent Skills. `--project` covers `.grok/config.toml`,
root `AGENTS.md`, and `.grok/skills/`.
