# agentmove

**Move your AI agent between clients.** The pandoc of agent ecosystems: migrate
**config + MCP servers + skills + memory + persona/instructions** between
OpenClaw, Hermes Agent, Claude Code, Codex CLI, Cursor, and Gemini CLI — in any
direction, with dry-run previews, diffs, and honest loss reporting.

Existing migration tools (like `hermes claw migrate`) are one-way doors into a
single vendor. agentmove is neutral, local-only, and open source: your agent's
brain belongs to you.

## Quick start

The npm package is **`agentmove-cli`** (the bare `agentmove` name collides with an
existing package under npm's hyphen-insensitive naming rules), but the installed
command is still `agentmove`:

```bash
npm install -g agentmove-cli   # installs the `agentmove` command
agentmove doctor
```

Or one-off with npx:

```bash
# See which agent clients live on this machine and what can be migrated
npx agentmove-cli doctor

# Preview a migration (nothing is written without --apply)
npx agentmove-cli convert openclaw hermes

# Actually migrate (existing files are backed up to ~/.agentmove/backups first)
npx agentmove-cli convert openclaw hermes --apply

# Or go through a portable bundle you can commit / carry to another machine
npx agentmove-cli export claude-code -o my-agent
npx agentmove-cli import codex -i my-agent --apply

# Compare two clients (or a bundle vs a client) layer by layer
npx agentmove-cli diff claude-code codex
```

> Until the package is published on npm, run from a checkout:
> `pnpm install && pnpm build`, then use
> `node packages/agentmove/dist/cli.js` in place of `npx agentmove-cli`.

## What gets migrated

| Layer | Notes |
| --- | --- |
| MCP servers | Near-lossless between all six clients (JSON/JSON5/TOML/YAML shapes normalized) |
| Instructions | `AGENTS.md` ↔ `CLAUDE.md` ↔ `GEMINI.md` ↔ Cursor rules |
| Persona | `SOUL.md` (OpenClaw/Hermes native; approximated into instructions elsewhere, with a warning) |
| Memory | OpenClaw `MEMORY.md`/daily files, Hermes `§` entries, Gemini "Added Memories" — normalized entries + raw originals kept in the bundle |
| Skills | `SKILL.md` directories (the de-facto cross-client standard) |
| Config | Default model plus the raw source config preserved in the bundle for reference |

Every lossy or approximated step is reported as a warning — nothing is silently
dropped. Likely secrets (env values named `*KEY*`, `*TOKEN*`, …) are replaced
with `${VAR}` placeholders unless you pass `--include-secrets`.

## Supported clients

| Client | id | Data read from |
| --- | --- | --- |
| OpenClaw | `openclaw` | `~/.openclaw/openclaw.json`, workspace (`SOUL.md`, `AGENTS.md`, `MEMORY.md`, `memory/`, `skills/`) |
| Hermes Agent | `hermes` | `~/.hermes/config.yaml`, `SOUL.md`, `memories/`, `skills/` |
| Claude Code | `claude-code` | `~/.claude.json`, `~/.claude/CLAUDE.md`, `~/.claude/skills/` |
| Codex CLI | `codex` | `~/.codex/config.toml`, `~/.codex/AGENTS.md`, `~/.agents/skills/` |
| Cursor | `cursor` | `~/.cursor/mcp.json` (rules/memories are project/app-scoped) |
| Gemini CLI | `gemini` | `~/.gemini/settings.json`, `~/.gemini/GEMINI.md` |

## Commands

- `agentmove export <client> [-o dir]` — client → portable bundle
- `agentmove import <client> [-i dir] [--apply]` — bundle → client (dry-run by default)
- `agentmove convert <from> <to> [--apply]` — direct client → client
- `agentmove diff <from> <to>` — layer-by-layer comparison
- `agentmove doctor` — detect installed clients and inventory migratable data

## Safety model

1. **Dry-run by default** — `import`/`convert` print a plan; `--apply` is explicit.
2. **Automatic backups** — every file that would be overwritten is copied to
   `~/.agentmove/backups/<timestamp>/` first.
3. **Secrets stay put** — redacted to `${VAR}` placeholders unless
   `--include-secrets` is passed.

## Development

```bash
pnpm install
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```

Adapters are plugins: implement the `ClientAdapter` interface in
`packages/agentmove/src/adapters/` and register it in `adapters/index.ts`.
Research behind the format mappings lives in
[`docs/research/`](docs/research/) (proposal, competitive comparison, and the
per-client format matrix).

## License

Apache-2.0
