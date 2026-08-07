---
title: Commands
description: The five AgentMove commands.
---

## `agentmove export <client> [-o dir] [--json]`

Reads the client's config, MCP servers, instructions, persona, memory, and
skills into a portable bundle directory (default `./agentmove-bundle`).
Likely secrets are redacted to `${VAR}` placeholders unless `--include-secrets`.

## `agentmove import <client> [-i dir] [--apply] [--replace-mcp] [--only layers] [--json]`

Plans the file writes needed to apply a bundle to a client. Dry-run by
default: prints each file that would be written. With `--apply`, existing
files are first backed up to `~/.agentmove/backups/<timestamp>/`.

Imported MCP servers are **merged** into the target's existing server list
(like the official `mcp add` commands) — servers the target already has are
never removed. Same-name conflicts are won by the imported entry, with a
warning. Pass `--replace-mcp` to replace the list entirely instead.

## `agentmove convert <from> <to> [--apply] [--replace-mcp] [--only layers] [--json]`

`export` + `import` in one step, without leaving a bundle on disk. Uses the
same MCP merge semantics as `import`.

## Partial migration: `--only`

`export`, `import`, and `convert` accept `--only <layers>` — a comma-separated
subset of `mcp`, `skills`, `memory`, `instructions`, `persona` — to migrate
only those layers. For example, to copy just the MCP servers from Claude Code
to Codex without touching instructions or skills:

```bash
agentmove convert claude-code codex --only mcp --apply
```

Unknown layer names fail with exit code 2.

## Project-scoped migration: `--project`

`export`, `import`, and `convert` accept `--project <dir>` to operate on the
client's **project-scoped** files inside a repository instead of the
user-scoped config under `$HOME`:

| Client | Project files |
|---|---|
| claude-code | `.mcp.json`, `CLAUDE.md`, `.claude/skills/` |
| codex | `AGENTS.md`, `.agents/skills/` (no project-scoped MCP config — warned) |
| gemini | `.gemini/settings.json`, `GEMINI.md` |
| cursor | `.cursor/mcp.json`, `.cursor/rules/*.mdc` |
| windsurf | `.windsurf/rules/*.md`, `.windsurf/skills/` (no project-scoped MCP config — warned) |
| copilot | `.mcp.json`, `.github/copilot-instructions.md` + `.github/instructions/`, `.github/skills/` |
| cline | `.clinerules/*.md`, `.cline/skills/` (no project-scoped MCP config — warned) |
| warp | `.warp/.mcp.json`, `AGENTS.md` (legacy `WARP.md` read), `.warp/skills/` |

```bash
# move a repo's Claude Code setup to Cursor, in place
agentmove convert claude-code cursor --project . --apply
```

Backups go to `<dir>/.agentmove/backups/<timestamp>/`. MCP merge semantics and
secret redaction work the same as user-scoped migration. OpenClaw and Hermes
have no project-scoped files — `--project` with them is a usage error (exit 2).

## Memory interchange: `--mif`

`export --mif <file>` additionally writes the memory layer as a vendor-neutral
[MIF v2](https://github.com/varun29ankuS/mif-spec) document (`mif_version`,
`memories[]` with `id`/`content`/`created_at`), so memories can be handed to
any MIF-speaking memory system. `import <client> --mif <file>` imports the
memory layer from a MIF document instead of a bundle:

```bash
agentmove export openclaw -o bundle --mif memories.mif.json
agentmove import gemini --mif memories.mif.json --apply
```

MIF fields with no portable equivalent (embeddings, knowledge-graph data) are
dropped with a warning; a non-MIF file is a data error (exit 3).

## Encrypted transport: `pack` / `unpack`

`pack <bundle> [-o file]` encrypts a bundle directory into a single portable
`.agentpack` file (AES-256-GCM, key derived from the `AGENTMOVE_PASSPHRASE`
environment variable via scrypt) so an agent can be carried across machines
safely — including through untrusted channels like mail or cloud drives.
`unpack <file> [-o dir]` decrypts it back into a bundle directory, and
`import -i` accepts an `.agentpack` file directly:

```bash
AGENTMOVE_PASSPHRASE='...' agentmove export openclaw -o bundle
AGENTMOVE_PASSPHRASE='...' agentmove pack bundle -o agent.agentpack
# on the other machine
AGENTMOVE_PASSPHRASE='...' agentmove import claude-code -i agent.agentpack --apply
```

A missing passphrase is a usage error (exit 2); a wrong passphrase or tampered
file fails authentication and is a data error (exit 3). Note that exported
bundles redact likely secrets by default — encryption is for everything else
(instructions, memory, persona, server lists). If you pack a bundle exported
with `--include-secrets`, the ciphertext protects them in transit, but treat
the passphrase accordingly.

## `agentmove diff <from> <to> [--json]`

Layer-by-layer structural comparison between two clients, or between a bundle
directory and a client. Output uses `+` (added), `-` (removed), `~` (changed).

## `agentmove clients [--json]`

Lists the supported clients with their ids and default config locations
(like pandoc's `--list-input-formats`).

## `agentmove completion <bash|zsh|fish>`

Prints a shell completion script covering commands, client ids, and flags.
Enable it with:

```bash
eval "$(agentmove completion bash)"                    # bash / zsh
agentmove completion fish | source                     # fish
```

## `agentmove doctor [--json]`

Detects which supported clients are configured on this machine and inventories
what AgentMove can migrate from each (MCP servers, skills, memory entries,
instructions, persona), including any format warnings.

## Man page

A global install (`npm i -g agentmove-cli`) also links a man page:
`man agentmove-cli`.

## Global options

- `--home <dir>` — override the home directory (useful for testing and staging).
- `--only <layers>` (on `export`, `import`, `convert`) — migrate only the
  listed layers (`mcp,skills,memory,instructions,persona`).
- `--project <dir>` (on `export`, `import`, `convert`) — operate on the
  client's project-scoped files in a repository instead of `$HOME`.
- `--mif <file>` (on `export`, `import`) — exchange the memory layer as a
  MIF v2 document.
- `--debug` (or `AGENTMOVE_DEBUG=1`) — print a full stack trace on unexpected
  errors; by default errors are a single readable line.
- `--json` (on `export`, `import`, `convert`, `diff`, `pack`, `unpack`, `doctor`, `clients`) — machine-readable JSON on
  stdout for scripts and CI: the migration plan, warnings, per-layer summary,
  and backup directory. After `--apply`, the human output also ends with a
  `migrated: …` per-layer summary line.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | success |
| 1 | unexpected error (permission errors include remediation guidance) |
| 2 | usage error (e.g. unknown client) |
| 3 | bad input data (missing/corrupt bundle or config; the message includes the offending file path) |
