---
"agentmove-cli": minor
---

Add Kilo Code as the 32nd supported client. User scope migrates the `mcp` key
inside `~/.config/kilo/kilo.json` (kilo.jsonc/config.json also read, JSONC
accepted, other config keys preserved on rewrite; `type: local/remote` with
argv-array `command` + `environment`; native `enabled` flag round-trips),
`~/.config/kilo/AGENTS.md` global instructions, and `~/.kilo/skills/` Agent
Skills. `--project` covers `kilo.json`/`.kilo/kilo.json(c)`, root `AGENTS.md`,
and `.kilo/skills/`.
