---
title: Quick start
description: Migrate an agent in two commands.
---

The npm package is **`agentmove-cli`** (the bare `agentmove` name collides with
an existing package under npm's hyphen-insensitive naming rules), but the
installed command is still `agentmove`:

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

# Actually migrate — existing files are backed up to ~/.agentmove/backups first
npx agentmove-cli convert openclaw hermes --apply
```

Or go through a portable bundle:

```bash
npx agentmove-cli export claude-code -o my-agent
npx agentmove-cli import codex -i my-agent --apply
```

:::tip
Enable tab completion with `eval "$(agentmove completion bash)"` (also `zsh`
and `fish`), and see `man agentmove-cli` after a global install.
:::
