---
title: Limitations — what cannot migrate
description: An honest list of the capability boundaries of memory and persona migration.
---

AgentMove would rather tell you "no" than pretend. This page is the complete,
honest list of what does **not** migrate (as of v0.1), and why. Everything here
is also surfaced as a runtime warning when it affects your migration.

## Memory

Memory is the least portable layer, because most clients don't store it in
user-editable files:

| Client | Boundary |
| --- | --- |
| Cursor | Memories live in the app's internal database. **Cannot be exported or imported at all.** |
| Claude Code | Auto-memory is session/project-scoped and client-managed. **Not exported.** Durable notes in `CLAUDE.md` migrate fine (as instructions). |
| Codex CLI | Client-managed memories are not readable as files. **Not exported.** Imported memory is appended to `~/.codex/AGENTS.md` — the agent will *read* it, but it won't live in Codex's own memory store. |
| Gemini CLI | Only the "Gemini Added Memories" section of `GEMINI.md` migrates. |
| OpenClaw / Hermes | File-based (`MEMORY.md`, daily files, `§` entries) — migrates fully, both directions. |

Practical consequence: **OpenClaw ↔ Hermes memory migration is lossless;
migrating memory into Claude Code / Codex / Gemini is an instructions-level
approximation; migrating memory out of Cursor / Claude Code / Codex is not
possible.**

## Persona

Only OpenClaw and Hermes have a native persona slot (`SOUL.md`). For every
other target, the persona is appended to the instructions file under an
`Imported by agentmove` heading and the migration is flagged `approximated`.
The agent will behave similarly, but the client's UI won't treat it as a
persona, and a later export won't recover it as a separate `persona.md`.

## Skills

- Gemini CLI has no `SKILL.md` mechanism — skills are **skipped** (a Gemini
  extension would be the manual equivalent).
- Cursor has no skills directory — **skipped** (convert to rules manually).
- Binary assets inside skill directories are currently skipped with a warning.

## MCP servers

Near-lossless, with these edges:

- OpenClaw `toolFilter` and Hermes tool include/exclude lists have no portable
  equivalent — **dropped with a warning**.
- HTTP `headers` are not documented for Hermes — dropped when importing there.
- `disabled` flags don't exist in Claude Code / Cursor / Gemini — servers are
  emitted enabled, with a warning.
- JSON5 comments in `openclaw.json` are not preserved on rewrite.

## Scope

v0.1 migrates **user-level (home directory) setups only**. Project-scoped
files (`.mcp.json`, `.cursor/rules/*.mdc`, per-repo `AGENTS.md`) are on the
[roadmap](https://github.com/wookat/agentmove/blob/main/ROADMAP.md).
