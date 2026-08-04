---
title: Commands
description: The five AgentMove commands.
---

## `agentmove export <client> [-o dir]`

Reads the client's config, MCP servers, instructions, persona, memory, and
skills into a portable bundle directory (default `./agentmove-bundle`).
Likely secrets are redacted to `${VAR}` placeholders unless `--include-secrets`.

## `agentmove import <client> [-i dir] [--apply]`

Plans the file writes needed to apply a bundle to a client. Dry-run by
default: prints each file that would be written. With `--apply`, existing
files are first backed up to `~/.agentmove/backups/<timestamp>/`.

## `agentmove convert <from> <to> [--apply]`

`export` + `import` in one step, without leaving a bundle on disk.

## `agentmove diff <from> <to>`

Layer-by-layer structural comparison between two clients, or between a bundle
directory and a client. Output uses `+` (added), `-` (removed), `~` (changed).

## `agentmove doctor`

Detects which supported clients are configured on this machine and inventories
what AgentMove can migrate from each (MCP servers, skills, memory entries,
instructions, persona), including any format warnings.

## Global options

- `--home <dir>` — override the home directory (useful for testing and staging).
