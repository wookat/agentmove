---
title: Quick start
description: Migrate an agent in two commands.
---

```bash
# See which agent clients live on this machine and what can be migrated
npx agentmove doctor

# Preview a migration (nothing is written without --apply)
npx agentmove convert openclaw hermes

# Actually migrate — existing files are backed up to ~/.agentmove/backups first
npx agentmove convert openclaw hermes --apply
```

Or go through a portable bundle:

```bash
npx agentmove export claude-code -o my-agent
npx agentmove import codex -i my-agent --apply
```

:::note
Until the package is published on npm, run from a checkout:
`pnpm install && pnpm build`, then use `node packages/agentmove/dist/cli.js`
in place of `npx agentmove`.
:::
