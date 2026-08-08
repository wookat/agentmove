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
| Xcode Claude Agent / Codex / Gemini | Same behavior as the corresponding standalone client, in the isolated `~/Library/Developer/Xcode/CodingAssistant` root (macOS only). |
| Qwen Code | Only the "Qwen Added Memories" section of `QWEN.md` migrates. |
| goose | Memory-extension files (`~/.config/goose/memory/*.txt`) migrate both directions; category names and `# tag` lines are not portable. |
| Windsurf | Cascade memories are app-managed. **Cannot be exported or imported.** Durable rules in `global_rules.md` migrate as instructions. |
| Amp | No durable memory store — imported memory is appended to `~/AGENTS.md` (approximated, warned). |
| CodeBuddy | Auto-memory is app-managed runtime data — imported memory is **skipped** with a warning (`CODEBUDDY.md` migrates as instructions). |
| Qoder CLI | Auto-memory is app-managed runtime data — imported memory is **skipped** with a warning (`~/.qoder/AGENTS.md` migrates as instructions). |
| Auggie CLI | Augment Memories are app-managed — imported memory is **skipped** with a warning (`~/.augment/rules/` migrates as instructions). |
| JetBrains AI Assistant | Chat memory and prompts are IDE-managed — imported memory is **skipped** with a warning; user-level instructions have no file slot (project rules migrate with `--project`). |
| Baidu Comate | Chat memory is app-managed under `.comate` — imported memory is **skipped** with a warning; MCP servers and rules migrate with `--project` only. |
| Muse Code | Personal memory and machine-wide user rules are app-managed — imported user-scope memory/instructions are **skipped** with a warning; project memory migrates via `.agents/memory/` with `--project` (imports write `.agents/memory/agentmove.md` — add an index line to `MEMORY.md`). |
| Cline / Zed / OpenHands / Copilot CLI / OpenCode / Claude Desktop / VS Code / Kiro / Roo Code / Continue / Crush / Antigravity / Droid / Amazon Q Developer CLI / Warp / Junie / LM Studio / Trae / Kilo Code / Kimi Code CLI / Grok CLI / Vibe Code CLI / Nanocoder / Jan / AnythingLLM / LibreChat | No durable user-editable memory store — imported memory is **skipped** with a warning (carry it with `--mif` instead). |
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
  Antigravity, Droid, Junie, and Gemini CLI (plus project scope for OpenHands).
- Amazon Q Developer CLI, LM Studio, and JetBrains AI Assistant have no
  user-level skills directory — **skipped** with a warning.
- VS Code skills live in the shared `~/.agents/skills/` root (project
  `.github/skills/` with `--project`) and migrate natively.
- Claude Desktop personal skills live in `~/.claude/skills/` (shared with
  Claude Code) and migrate natively.
- Gemini CLI skills live in `~/.gemini/skills/` (project `.gemini/skills/`
  with `--project`; `~/.agents/skills/` is a native alias) and migrate
  natively.
- Zed skills live in `~/.agents/skills/` (project `.agents/skills/` with
  `--project`) and migrate natively.
- Continue skills live in `~/.continue/skills/` (project `.continue/skills/`
  with `--project`) and migrate natively.
- Cline skills live in `~/.cline/skills/` (project `.cline/skills/` with
  `--project`) and migrate natively.
- Warp skills live in `~/.warp/skills/` (project `.warp/skills/` with
  `--project`) and migrate natively.
- GitHub Copilot CLI skills live in `~/.copilot/skills/` (project
  `.github/skills/` with `--project`) and migrate natively.
- Windsurf skills live in `~/.codeium/windsurf/skills/` (project
  `.windsurf/skills/` with `--project`) and migrate natively.
- Cursor global skills live in `~/.cursor/skills/` and migrate natively;
  project skills in `.cursor/skills/` migrate with `--project`.
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
- Kimi Code CLI global skills live in `~/.kimi-code/skills/` and migrate natively;
  project skills in `.kimi-code/skills/` migrate with `--project`.
- Grok CLI global skills live in `~/.grok/skills/` and migrate natively;
  project skills in `.grok/skills/` migrate with `--project`.
- Vibe Code CLI global skills live in `~/.vibe/skills/` and migrate natively;
  project skills in `.vibe/skills/` migrate with `--project`.
- Binary assets inside skill directories are currently skipped with a warning.

## Custom agents (subagents)

- Custom agent / subagent markdown definitions migrate natively between
  Claude Code (`~/.claude/agents/`, project `.claude/agents/`), GitHub
  Copilot CLI (`~/.copilot/agents/*.agent.md`, project `.github/agents/`),
  Gemini CLI (`~/.gemini/agents/`, project `.gemini/agents/`), OpenCode
  (`~/.config/opencode/agents/`, legacy `agent/` also read, project
  `.opencode/agents/`), Qwen Code (`~/.qwen/agents/`, project
  `.qwen/agents/`), Cursor (`~/.cursor/agents/`, project
  `.cursor/agents/`), Kiro (`~/.kiro/agents/`, project
  `.kiro/agents/`), Droid (`~/.factory/droids/`, project
  `.factory/droids/`), CodeBuddy (`~/.codebuddy/agents/`, project
  `.codebuddy/agents/`), Qoder CLI (`~/.qoder/agents/`, project
  `.qoder/agents/`), and Kimi Code CLI (`~/.kimi-code/agents/` plus the
  shared `~/.agents/agents/`, project `.kimi-code/agents/` plus
  `.agents/agents/`; directories are scanned recursively and subdirectory
  paths are preserved — imports write only the brand-native
  `.kimi-code/agents/` directory).
- Content is copied **as-is**, including YAML frontmatter. Fields like
  `tools:`, `model:`, Cursor's `read_only:`/`is_background:`, Kiro's
  `permissions:`, Droid's `reasoningEffort:`/`mcpServers:`, Qoder's
  `skills:`/`mcpServers:` allowlists, CodeBuddy's
  `effort:`/`maxTurns:`/`memory:`/`mcpServers:`, and Kimi Code CLI's
  `disallowedTools:`/`subagents:`/`model_preference:`/`override:` are
  client-specific and may need review after import — a warning is emitted.
- Kiro also accepts JSON agent configs (`.kiro/agents/*.json`); those are
  **not** migrated (warned) — Kiro supports the same fields in markdown.
- Gemini CLI subagents are experimental (enabled by default;
  `"experimental": {"enableAgents": false}` in `settings.json` disables
  them) — warned on import.
- Every other client has no custom agents directory — imported agents are
  **skipped** with a warning.

## Commands / custom prompts

- Markdown slash commands / reusable prompts migrate natively between
  Claude Code (`~/.claude/commands/`, project `.claude/commands/`;
  subdirectories become namespaced command names and are preserved),
  Cursor (`~/.cursor/commands/`, project `.cursor/commands/`),
  Codex CLI (`~/.codex/prompts/`, user scope only, invoked as
  `/prompts:<name>`), OpenCode (`~/.config/opencode/commands/`, project
  `.opencode/commands/`; subdirectories preserved), Qwen Code
  (`~/.qwen/commands/`, project `.qwen/commands/`; subdirectories
  preserved and shown as `/git:commit`-style namespaced names),
  Windsurf (workflows: `~/.codeium/windsurf/global_workflows/`, project
  `.windsurf/workflows/`; invoked as `/name`), Amazon Q Developer
  CLI (saved prompts: `~/.aws/amazonq/prompts/`, project
  `.amazonq/prompts/`; invoked as `@name` in `q chat`), CodeBuddy
  (`~/.codebuddy/commands/`, project `.codebuddy/commands/`;
  subdirectories preserved and shown as `/group:command`-style
  namespaced names), Droid (`~/.factory/commands/`, project
  `.factory/commands/`; subdirectories preserved; filenames are slugged
  by the client on discovery), Qoder CLI (`~/.qoder/commands/`, project
  `.qoder/commands/`; subdirectories preserved and shown as
  `/group:command`-style namespaced names), Roo Code
  (`~/.roo/commands/`, project `.roo/commands/`; flat), Kilo Code
  (`~/.config/kilo/commands/`, project `.kilo/commands/`; flat; legacy
  `~/.kilocode/workflows/` / `.kilocode/workflows/` still read with the
  new location winning on name conflicts — imports write only the new
  location), and Cline (workflows: `~/Documents/Cline/Workflows/`,
  project `.clinerules/workflows/`; flat, invoked as `/name.md`).
- Content is copied **as-is**. Argument placeholders (`$ARGUMENTS`,
  `$1`…, `{{args}}`, `!{...}`, `@{...}`) and frontmatter fields
  (`allowed-tools:`, `model:`, `argument-hint:`, `agent:`) are
  client-specific and may need review after import — a warning is
  emitted.
- Cursor, Codex, Windsurf, Amazon Q, Roo Code, Kilo Code, and Cline only discover top-level
  command files: nested names like `git/commit` are flattened to `git-commit` on
  import there, with a warning (name collisions after flattening skip
  the command).
- Windsurf workflow files are limited to 12000 characters — oversize
  commands are written as-is with a warning that Cascade may reject
  them.
- Codex custom prompts are deprecated in favor of skills but still
  supported — noted as a warning on import.
- Qwen Code's legacy TOML command files (`*.toml`) are deprecated and
  **not** migrated — each one is warned on export; convert them to
  markdown first.
- Droid shebang script commands (non-`.md` files under
  `.factory/commands/`) are executable shell scripts, not portable
  prompts — **not** migrated; each one is warned on export.
- Cline non-markdown workflow files (`.txt`, extensionless) are **not**
  migrated — each one is warned on export; enable/disable toggles are
  app-managed and not migrated.
- Every other client has no documented commands/prompts directory —
  imported commands are **skipped** with a warning.

## MCP servers

Near-lossless, with these edges:

- OpenClaw `toolFilter` and Hermes tool include/exclude lists have no portable
  equivalent — **dropped with a warning**.
- HTTP `headers` are not documented for Hermes — dropped when importing there.
- `disabled` flags don't exist in Claude Code / Cursor / Gemini / Copilot CLI /
  Qwen Code / Windsurf / Zed / OpenHands / Amp / VS Code / Continue /
  Claude Desktop / Warp / Junie / JetBrains AI Assistant / LM Studio / Trae / Baidu Comate / Qoder CLI / Auggie CLI — servers are emitted enabled, with a warning. (Cline,
  OpenCode, Kiro, Roo Code, Crush, Antigravity, Droid, Amazon Q Developer
  CLI, goose, Kilo Code, and Kimi Code CLI keep the
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
