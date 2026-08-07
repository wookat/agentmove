---
"agentmove-cli": minor
---

Agent Skills support for VS Code: personal skills migrate via `~/.agents/skills/`
(the shared cross-agent root VS Code now scans natively), and project skills via
`.github/skills/` with `--project`. The old "vscode has no SKILL.md mechanism"
skip warning is removed.
