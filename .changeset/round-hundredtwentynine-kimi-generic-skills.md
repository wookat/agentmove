---
"agentmove-cli": minor
---

Kimi Code CLI: also read Agent Skills from the generic shared root `~/.agents/skills/` (project: `.agents/skills/`), merged with the brand root `~/.kimi-code/skills/`. On duplicate names (compared case-insensitively) the brand copy wins with a warning, matching kimi's brand-then-generic scanner priority; imports keep writing only the brand root.
