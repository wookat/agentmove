# GAP-ROUND-81: Agent Skills support for VS Code

## Research

Ecosystem check after Agent Plugins 1.0.0 (2026-08-06): which supported
clients still carry a "no SKILL.md mechanism" skip warning but have since
shipped native Agent Skills support?

- **VS Code** — official docs (code.visualstudio.com/docs/agent-customization/agent-skills)
  now document Agent Skills:
  - Project skills: `.github/skills/`, `.claude/skills/`, `.agents/skills/`
  - Personal skills: `~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/`
  Our vscode adapter still skipped skills with "vscode has no SKILL.md
  mechanism" — stale.
- **Codex CLI** — already covered (`~/.agents/skills` since an earlier round).
- Other remaining skip warnings (jetbrains, librechat, anythingllm, jan,
  lmstudio, amazonq, claude-desktop, gemini, xcode-codex, nanocoder) were
  re-checked; no official Agent Skills mechanism found — warnings remain
  honest.

## Decision

- User level: read/write `~/.agents/skills/` — the shared cross-agent root VS
  Code scans natively. `~/.copilot/skills` and `~/.claude/skills` belong to the
  copilot / claude-code clients in AgentMove, so using them would create double
  ownership. Import emits a shared-root warning (same pattern as zed /
  warp-cli / amp).
- Project level (`--project`): read/write `.github/skills/` — listed first in
  the official docs and matches the copilot project convention.
- The old skip warnings are removed at both scopes.

## Alternatives considered

- Reading all three personal locations on export: rejected — would duplicate
  skills already owned by copilot/claude-code exports and complicate
  round-trips.
- `chat.agentSkillsLocations` custom locations: client-specific setting, not
  migrated (out of scope).
