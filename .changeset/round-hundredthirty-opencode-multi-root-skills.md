---
"agentmove-cli": minor
---

OpenCode multi-root Agent Skills: exports now merge `~/.config/opencode/{skills,skill}/`, the `~/.opencode/{skills,skill}/` fallback config dir, and the generic shared root `~/.agents/skills/` (project: `.opencode/{skills,skill}/` + `.agents/skills/`), matching opencode's own skill discovery. On duplicate names the first root in that order wins with a shadow warning; imports keep writing only `~/.config/opencode/skills/`.
