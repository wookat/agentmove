---
title: Commands
description: The five AgentMove commands.
---

## `agentmove export <client> [-o dir] [--json]`

Reads the client's config, MCP servers, instructions, persona, memory, and
skills into a portable bundle directory (default `./agentmove-bundle`).
Likely secrets are redacted to `${VAR}` placeholders unless `--include-secrets`.

## `agentmove import <client> [-i dir] [--apply] [--replace-mcp] [--json]`

Plans the file writes needed to apply a bundle to a client. Dry-run by
default: prints each file that would be written. With `--apply`, existing
files are first backed up to `~/.agentmove/backups/<timestamp>/`.

Imported MCP servers are **merged** into the target's existing server list
(like the official `mcp add` commands) — servers the target already has are
never removed. Same-name conflicts are won by the imported entry, with a
warning. Pass `--replace-mcp` to replace the list entirely instead.

## `agentmove convert <from> <to> [--apply] [--replace-mcp] [--json]`

`export` + `import` in one step, without leaving a bundle on disk. Uses the
same MCP merge semantics as `import`.

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

## Global options

- `--home <dir>` — override the home directory (useful for testing and staging).
- `--json` (on `export`, `import`, `convert`, `diff`, `doctor`, `clients`) — machine-readable JSON on
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
