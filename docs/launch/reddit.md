# Reddit 草稿（r/LocalLLaMA / r/ClaudeAI 适配，勿外发）

**Title**: I built a "pandoc for AI agents" — migrate memory/skills/MCP/persona between Claude Code, Codex, Cursor, Gemini CLI, OpenClaw, Hermes in any direction

**Body**:

Vendor migration tools (like hermes claw migrate) only move you *in*, never
*out*. AgentMove is a neutral, local-only CLI:

- `agentmove doctor` — see what's on your machine
- `agentmove convert <from> <to>` — dry-run plan first, `--apply` to write (with automatic backups)
- `agentmove export/import` — portable bundle you can commit to git or carry to another machine
- `agentmove diff a b` — layer-by-layer comparison

It's honest about what can't migrate (Cursor's app-managed memories, Gemini's
lack of skills…) — every lossy step is a visible warning, and secrets get
redacted to ${VAR} placeholders by default.

npm: `agentmove-cli` (command is `agentmove`) · Docs: https://agentmove.zalize.com · Apache-2.0
