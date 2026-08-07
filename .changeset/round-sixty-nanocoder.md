---
"agentmove-cli": minor
---

Nanocoder adapter (36th client): `~/.config/nanocoder/.mcp.json` `mcpServers` map with explicit `transport` (stdio/http; websocket skipped with a warning), `enabled` flag round-trip, `timeout`/`alwaysAllow`/`description`/`tags` warned as client-specific and preserved on merge; project scope covers `.mcp.json` and the root `AGENTS.md`. Nanocoder skills use their own skill.yaml bundle format and are skipped with a warning.
