---
title: Migrate from Gemini CLI to Antigravity
description: Move your Gemini CLI MCP servers and context into Antigravity 2.0 / the Antigravity CLI (agy) with one command.
---

Google retired the consumer tiers of **Gemini CLI on June 18, 2026** in favor
of the **Antigravity CLI** (`agy`), which shares one config surface with the
Antigravity 2.0 desktop app and the Antigravity IDE. Enterprise and paid-API
access to Gemini CLI continues, but for everyone else the terminal experience
is now Antigravity.

The formats are not compatible: Gemini CLI keeps MCP servers under
`mcpServers` in `~/.gemini/settings.json`, while Antigravity reads
`~/.gemini/config/mcp_config.json` and requires remote servers to use
`serverUrl` instead of `url`/`httpUrl`. AgentMove translates between them.

## One command

```bash
# Preview first — nothing is written without --apply
npx agentmove-cli convert gemini antigravity

# Apply it — existing files are backed up to ~/.agentmove/backups
npx agentmove-cli convert gemini antigravity --apply
```

## What moves, what stays

- **MCP servers** are translated from `~/.gemini/settings.json` into
  `~/.gemini/config/mcp_config.json` — stdio servers keep
  `command`/`args`/`env`/`cwd`; remote servers are rewritten to the
  `serverUrl` notation Antigravity requires. Servers already present in the
  Antigravity config are preserved (merge by name; `--replace-mcp` to
  replace). One migration covers all three Antigravity surfaces — desktop,
  IDE, and `agy`.
- **Instructions and memories** in `~/.gemini/GEMINI.md` (including the
  "Gemini Added Memories" section) don't need to move at all: Antigravity
  reads the same file as its global rules. AgentMove leaves it in place.
- **Secrets** in `env` values and `Authorization` headers are redacted to
  `${VAR}` placeholders by default; pass `--include-secrets` if you really
  want literal values written.
- **Anything without a portable equivalent** is reported as a warning, never
  dropped silently — for example Gemini CLI extensions are not exported;
  reinstall them as Antigravity plugins on the target.

Moving to a new machine at the same time? Export once and carry an encrypted
bundle:

```bash
npx agentmove-cli export gemini -o my-agent
AGENTMOVE_PASSPHRASE='...' npx agentmove-cli pack my-agent -o agent.agentpack
# on the new machine
AGENTMOVE_PASSPHRASE='...' npx agentmove-cli import antigravity -i agent.agentpack --apply
```

See [Supported clients](/docs/clients/) for the full per-client notes and
[Loss reporting & safety](/docs/safety/) for how warnings and backups work.
