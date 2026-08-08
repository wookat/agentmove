---
"agentmove-cli": minor
---

Portable custom agents (subagents) layer: migrate agent markdown definitions between Claude Code (`~/.claude/agents/`, project `.claude/agents/`), GitHub Copilot CLI (`~/.copilot/agents/*.agent.md`, project `.github/agents/`), and Gemini CLI (`~/.gemini/agents/`, project `.gemini/agents/`, experimental but enabled by default). Content round-trips byte-for-byte with honest warnings for client-specific frontmatter fields; other clients skip the layer with a warning. New `agents` value for `--only`; `diff` and `doctor` report the layer.
