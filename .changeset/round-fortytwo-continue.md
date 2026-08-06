---
"agentmove-cli": minor
---

New client: Continue (continue.dev IDE extensions + `cn` CLI) — 20th supported client. Reads/writes the `mcpServers` list in `~/.continue/config.yaml` (name-keyed merge; remote servers use Continue's explicit `type: streamable-http`/`sse`, imported headers become `requestOptions.headers`), migrates rules markdown in `~/.continue/rules/`, and supports project scope (`.continue/mcpServers/` standalone blocks + `.continue/rules/`). Client-specific `requestOptions`/`connectionTimeout` settings, the missing disabled flag, and the absence of SKILL.md skills or durable memory are all reported as warnings.
