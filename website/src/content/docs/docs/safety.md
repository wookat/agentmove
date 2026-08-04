---
title: Loss reporting & safety
description: How AgentMove keeps migrations honest and reversible.
---

## Dry-run by default

`import` and `convert` only print the plan. `--apply` is an explicit opt-in.

## Automatic backups

Before applying, every file that would be overwritten is copied to
`~/.agentmove/backups/<timestamp>/`, preserving relative paths.

## Honest loss reporting

Adapters never drop data silently. Every incompatibility produces a warning
telling you what happened and where the data went:

- `dropped` — no equivalent exists (e.g. OpenClaw `toolFilter`)
- `approximated` — mapped to the nearest concept (e.g. persona appended to `CLAUDE.md`)
- `skipped` — not migrated in v0 (e.g. binary skill assets)

## Secrets

Env/header values whose names look like secrets (`*KEY*`, `*TOKEN*`,
`*SECRET*`, `*PASSWORD*`, `*CREDENTIAL*`) are replaced with `${VAR}`
placeholders on export. Pass `--include-secrets` to keep real values — only do
this for bundles that never leave your machine.
