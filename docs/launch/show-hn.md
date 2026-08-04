# Show HN 草稿（勿外发，发布动作等总负责人指令）

**Title**: Show HN: AgentMove – move your AI agent between Claude Code, Codex, Cursor, and more

**Body**:

Last year Hermes Agent got 210k stars largely off one feature: `hermes claw
migrate`, a one-click import from OpenClaw. That proved people desperately want
to move their agent — memory, skills, persona, MCP servers — but every existing
tool is a one-way door *into* one vendor.

AgentMove is the neutral version: a local-only CLI that migrates config + MCP
servers + skills + memory + persona/instructions between OpenClaw, Hermes,
Claude Code, Codex CLI, Cursor, and Gemini CLI — any direction.

    npx agentmove-cli doctor            # inventory what you have
    npx agentmove-cli convert claude-code codex   # dry-run plan
    npx agentmove-cli convert claude-code codex --apply

Design choices I'd love feedback on:
- Dry-run by default; --apply backs up every overwritten file first.
- Honest loss reporting: persona has no native slot in most clients, so it's
  appended to the instructions file and *labeled approximated* — nothing is
  silently dropped. The limitations page lists exactly what cannot migrate
  (e.g. Cursor's app-managed memories).
- Likely secrets are redacted to ${VAR} placeholders unless you opt in.
- A portable bundle format in between, so you can also git-version your agent.

Docs: https://agentmove.zalize.com — Code: https://github.com/wookat/agentmove (Apache-2.0)
