---
title: The bundle format
description: AgentMove's portable intermediate representation.
---

`agentmove export` writes a plain-files bundle you can inspect, commit to git,
or carry to another machine:

```
agentmove-bundle/
  manifest.json          # schemaVersion, source client, export time
  config.json            # normalized model + raw source config for reference
  mcp-servers.json       # normalized MCP server list
  instructions.md        # AGENTS.md / CLAUDE.md / GEMINI.md-style instructions
  persona.md             # SOUL.md-style persona
  memory/
    memory.json          # normalized entries: content, source, kind, date
    raw/*.md             # original memory files, byte-for-byte
  skills/<name>/SKILL.md # skill directories (plus scripts/assets)
```

Memory entries carry a `kind` (`long-term` | `daily` | `user-profile`) so
adapters can map them to each client's native layout (e.g. Hermes `§` entries,
OpenClaw daily files, Gemini's "Added Memories" section). The raw originals are
kept alongside so same-family migrations stay lossless.
