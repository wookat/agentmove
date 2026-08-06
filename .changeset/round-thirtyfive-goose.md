---
"agentmove-cli": minor
---

New client: goose (`goose`, by Block). Migrates MCP servers from the
`extensions` key of `~/.config/goose/config.yaml` (stdio `cmd`/`args`/`envs`,
remote `streamable_http`/`sse` with `uri`; builtin/platform extensions are
goose-internal and skipped), global instructions from
`~/.config/goose/.goosehints`, durable memories from the memory extension's
`~/.config/goose/memory/*.txt` files, and skills from the `~/.agents/skills/`
standard location. Project scope via `--project` (`.goosehints`,
`.goose/memory/`, `.agents/skills/`; goose extensions are user-scoped only).
