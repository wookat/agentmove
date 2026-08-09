---
"agentmove-cli": minor
---

Amp Agent Skills: user-level export now reads all three amp-owned skill roots in upstream priority order — `~/.config/agents/skills/` (where `amp skill add --global` installs), `~/.agents/skills/`, and `~/.config/amp/skills/` — with the first skill of a given name winning and shadowed lower-priority copies warned. Imports keep writing the shared `~/.agents/skills/` root, and a warning now flags any same-name skill already in `~/.config/agents/skills/` that amp would prefer over the imported copy.
