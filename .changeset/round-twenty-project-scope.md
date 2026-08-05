---
"agentmove-cli": minor
---

Project-scoped migration: `export`/`import`/`convert` accept `--project <dir>`
to migrate a repository's client files instead of user-scoped config —
`.mcp.json`/`CLAUDE.md`/`.claude/skills` (claude-code), `AGENTS.md`/`.agents/skills`
(codex), `.gemini/settings.json`/`GEMINI.md` (gemini), and
`.cursor/mcp.json`/`.cursor/rules/*.mdc` (cursor). MCP merge semantics, secret
redaction, dry-run, and backups (to `<dir>/.agentmove/backups`) work the same
as user-scoped migration. OpenClaw/Hermes have no project scope (usage error).
