---
"agentmove-cli": minor
---

New client: Crush (Charm) — 21st supported client. Reads/writes the `mcp` map in `~/.config/crush/crush.json` (explicit `type: stdio`/`http`/`sse`; native `disabled` flag round-trips as portable `enabled: false`), migrates Agent Skills in `~/.config/crush/skills/`, and supports project scope (`crush.json`/`.crush.json` + `CRUSH.md` + `.crush/skills/`). Client-specific `disabled_tools`/`timeout` settings, the project-only nature of context files, and the absence of a durable memory store are all reported as warnings.
