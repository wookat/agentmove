---
"agentmove-cli": minor
---

Cursor now supports the Agent Skills standard (official cursor.com/docs/skills)
— the cursor adapter migrates skills instead of skipping them: user scope reads
and writes `~/.cursor/skills/`, project scope (`--project`) reads and writes
`.cursor/skills/`. The old "cursor has no skills directory" warning is gone.
