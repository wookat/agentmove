---
title: Limitations — what cannot migrate
description: An honest list of the capability boundaries of memory and persona migration.
---

AgentMove would rather tell you "no" than pretend. This page is the complete,
honest list of what does **not** migrate, and why. Everything here
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
| Qwen Code | Only the "Qwen Added Memories" section of `QWEN.md` migrates. |
| goose | Memory-extension files (`~/.config/goose/memory/*.txt`) migrate both directions; category names and `# tag` lines are not portable. |
| Windsurf | Cascade memories are app-managed. **Cannot be exported or imported.** Durable rules in `global_rules.md` migrate as instructions. |
| Amp | No durable memory store — imported memory is appended to `~/AGENTS.md` (approximated, warned). |
| CodeBuddy | Auto-memory is app-managed runtime data — imported memory is **skipped** with a warning (`CODEBUDDY.md` migrates as instructions). |
| Qoder CLI | Auto-memory is app-managed runtime data — imported memory is **skipped** with a warning (`~/.qoder/AGENTS.md` migrates as instructions). |
| Auggie CLI | Augment Memories are app-managed — imported memory is **skipped** with a warning (`~/.augment/rules/` migrates as instructions). |
| Cline / Zed / OpenHands / Copilot CLI / OpenCode / Claude Desktop / VS Code / Kiro / Roo Code / Continue / Crush / Antigravity / Droid / Amazon Q Developer CLI / Warp / Junie / LM Studio / Trae / Kilo Code | No durable user-editable memory store — imported memory is **skipped** with a warning (carry it with `--mif` instead). |
| OpenClaw / Hermes | File-based (`MEMORY.md`, daily files, `§` entries) — migrates fully, both directions. |

Practical consequence: **OpenClaw ↔ Hermes ↔ goose memory migration is
file-level; Gemini/Qwen migrate their "Added Memories" sections; migrating
memory into most other clients is an instructions-level approximation;
migrating memory out of Cursor / Claude Code / Codex / Windsurf is not
possible.**

## Persona

Only OpenClaw and Hermes have a native persona slot (`SOUL.md`). For every
other target, the persona is appended to the instructions file under an
`Imported by agentmove` heading and the migration is flagged `approximated`.
The agent will behave similarly, but the client's UI won't treat it as a
persona, and a later export won't recover it as a separate `persona.md`.

## Skills

- `SKILL.md` directories migrate natively between OpenClaw, Hermes, Claude
  Code, Codex, OpenCode, Qwen Code, goose, Amp, Kiro, Roo Code, Crush,
  Antigravity, Droid, and Junie (plus project scope for OpenHands).
- Gemini CLI has no `SKILL.md` mechanism — skills are **skipped** (a Gemini
  extension would be the manual equivalent).
- Cursor, Windsurf, Cline, Zed, Copilot CLI, VS Code, Continue, Claude
  Desktop, Amazon Q Developer CLI, Warp, and LM Studio have no user-level
  skills directory — **skipped** with a warning.
- Trae global skills live in `~/.trae/skills/` and migrate natively;
  project skills in `.trae/skills/` migrate with `--project`.
- CodeBuddy global skills live in `~/.codebuddy/skills/` and migrate natively;
  project skills in `.codebuddy/skills/` migrate with `--project`.
- Qoder CLI global skills live in `~/.qoder/skills/` and migrate natively;
  project skills in `.qoder/skills/` migrate with `--project`.
- Auggie CLI global skills live in `~/.augment/skills/` and migrate natively;
  project skills in `.augment/skills/` migrate with `--project`.
- Kilo Code global skills live in `~/.kilo/skills/` and migrate natively;
  project skills in `.kilo/skills/` migrate with `--project`.
- Binary assets inside skill directories are currently skipped with a warning.

## MCP servers

Near-lossless, with these edges:

- OpenClaw `toolFilter` and Hermes tool include/exclude lists have no portable
  equivalent — **dropped with a warning**.
- HTTP `headers` are not documented for Hermes — dropped when importing there.
- `disabled` flags don't exist in Claude Code / Cursor / Gemini / Copilot CLI /
  Qwen Code / Windsurf / Zed / OpenHands / Amp / VS Code / Continue /
  Claude Desktop / Warp / Junie / LM Studio / Trae / Qoder CLI / Auggie CLI — servers are emitted enabled, with a warning. (Cline,
  OpenCode, Kiro, Roo Code, Crush, Antigravity, Droid, Amazon Q Developer
  CLI, goose, and Kilo Code keep the
  flag natively; CodeBuddy keeps it via its top-level `disabledMcpServers`
  name list.)
- goose builtin/platform extensions are goose-internal — not exported;
  `available_tools` filters and keyring `env_keys` are not portable (warned).
- JSON5/JSONC comments (`openclaw.json`, Zed `settings.json`,
  `opencode.jsonc`) are not preserved on rewrite (warned).

See [Supported clients](/docs/clients/) for the full per-client lossy-edge
list.

## Scope

By default AgentMove migrates **user-level (home directory) setups**.
Project-scoped files (`.mcp.json`, `.cursor/rules/*.mdc`, per-repo
`AGENTS.md`, …) migrate with `--project <dir>` — supported for every client
except OpenClaw and Hermes, which have no project scope. See
[Commands](/docs/commands/) for details.
