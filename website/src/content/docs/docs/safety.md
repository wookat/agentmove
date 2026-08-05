---
title: Loss reporting & safety
description: How AgentMove keeps migrations honest and reversible.
---

## Dry-run by default

`import` and `convert` only print the plan. `--apply` is an explicit opt-in.

## Automatic backups

Before applying, every file that would be overwritten is copied to
`~/.agentmove/backups/<timestamp>/`, preserving relative paths.

## Merge, don't clobber

Imports merge MCP servers into the target's existing list — servers already
configured on the target are never removed (use `--replace-mcp` to opt into
replacement). Unrelated keys in the target's config files are preserved.

## Honest loss reporting

Adapters never drop data silently. Every incompatibility produces a warning
telling you what happened and where the data went:

- `dropped` — no equivalent exists (e.g. OpenClaw `toolFilter`)
- `approximated` — mapped to the nearest concept (e.g. persona appended to `CLAUDE.md`)
- `skipped` — not migrated in v0 (e.g. binary skill assets)

## Secrets

Env/header values whose names look like secrets (`*KEY*`, `*TOKEN*`,
`*SECRET*`, `*PASSWORD*`, `*CREDENTIAL*`, `*AUTHORIZATION*`, `*COOKIE*`) are replaced with `${VAR}`
placeholders on export. Pass `--include-secrets` to keep real values — only do
this for bundles that never leave your machine.

## Encrypted transport

When a bundle has to leave your machine (mail, cloud drives, USB sticks),
`agentmove pack` seals it into a single `.agentpack` file encrypted with
AES-256-GCM; the key is derived from the `AGENTMOVE_PASSPHRASE` environment
variable via scrypt. Tampering or a wrong passphrase fails authentication with
a data error (exit 3) — a corrupted or forged pack is never partially applied.
See [Commands](/docs/commands/#encrypted-transport-pack--unpack).
