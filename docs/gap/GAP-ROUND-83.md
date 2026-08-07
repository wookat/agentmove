# GAP-ROUND-83: Agent Skills support for Claude Desktop

## Research

Continuing the stale-skip-warning sweep after VS Code (ROUND-81): the official
Claude Desktop docs (code.claude.com/docs/en/desktop) now state:

> Personal skills in `~/.claude/skills/` apply to local sessions

so Desktop local sessions load the same personal Agent Skills root as Claude
Code. Our claude-desktop adapter still skipped skills with "claude-desktop has
no SKILL.md mechanism" — stale.

Notes from the same docs:

- Cowork / cloud sessions source skills from the claude.ai account
  (Customize), not from `~/.claude/skills` — app-managed, not migratable.
- SSH sessions read `~/.claude/skills` on the remote host.

## Decision

- User level: read/write `~/.claude/skills/` — shared with the claude-code
  client in AgentMove, so imports emit a shared-root warning (same pattern as
  vscode / zed / warp-cli / amp).
- No project scope change: Claude Desktop has no `--project` adapter.
- The old skip warning is removed; the export summary warning now reads
  "only MCP servers and skills migrate".

## Other remaining skip warnings re-checked

jan, anythingllm, lmstudio, amazonq, gemini, xcode-codex, xcode-gemini,
jetbrains (skills are IDE-managed via the Skill Manager's internal storage —
no stable file root documented), nanocoder (own skill.yaml format): no
standard Agent Skills directory found — warnings remain honest.
