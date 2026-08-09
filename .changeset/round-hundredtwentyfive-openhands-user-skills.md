---
"agentmove-cli": minor
---

OpenHands Agent Skills: user-level skills now migrate natively — export reads `~/.agents/skills/` plus the legacy `~/.openhands/skills/` (`.agents/skills` wins duplicate names with a warning; the managed `installed/` store is skipped with a warning), and imports write `~/.agents/skills/`, matching the agent SDK's USER_SKILLS_DIRS order. Project scope now also reads `.agents/skills/` alongside `.openhands/skills/` with the same precedence, and project imports write `.agents/skills/` (the upstream-preferred root). The stale "skills live in repositories" user-scope skip warning is removed.
