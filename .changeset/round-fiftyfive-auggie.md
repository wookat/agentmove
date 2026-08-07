---
"agentmove-cli": minor
---

Add Auggie CLI (Augment Code) as the 31st supported client. User scope
migrates the `mcpServers` key inside `~/.augment/settings.json` (other
settings preserved on rewrite; explicit `type` written on import),
`~/.augment/rules/*.md` user rules as instructions, and `~/.augment/skills/`
Agent Skills. `--project` covers `.augment/settings.json`, `.augment/rules/`,
and `.augment/skills/`.
