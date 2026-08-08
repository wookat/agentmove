---
"agentmove-cli": minor
---

Gemini CLI now migrates Agent Skills: user-level skills in `~/.gemini/skills/`
(the CLI's native skills directory; `~/.agents/skills/` is a built-in alias)
and project-level skills in `.gemini/skills/` with `--project`. The stale
"Gemini CLI has no SKILL.md mechanism" skip warning is removed. Xcode's
bundled Gemini agent is unchanged (skills support there is undocumented).
