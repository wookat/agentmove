# GAP ROUND-104 — commands layer: Windsurf workflows + Amazon Q saved prompts

Date: 2026-08-08. Follow-up to ROUND-102/103 (commands layer for Claude Code,
Cursor, Codex, OpenCode, Qwen Code).

## Candidates researched

### Windsurf workflows — SUPPORTED (this round)

- Official docs: https://docs.windsurf.com/windsurf/cascade/workflows
- Global: `~/.codeium/windsurf/global_workflows/*.md` (flat; filename becomes
  the `/name` slash command).
- Project: `.windsurf/workflows/*.md` (workspace, sub-dirs of the workspace
  are also scanned by Windsurf, but files created by tools conventionally go
  at the workspace root `.windsurf/workflows/`).
- Markdown with optional frontmatter (`description`, `auto_execution_mode`).
- Hard limit: 12000 characters per workflow file — AgentMove writes oversize
  commands as-is and warns that Cascade may reject them.
- Flat scan: nested normalized names (`git/commit`) are flattened to
  `git-commit` with a warning (planCommandsFlat).
- This resolves the ROUND-102 deferral of Windsurf workflows: they are a
  clean byte-faithful markdown command mapping after all — the earlier
  hesitation was about semantics ("workflows" vs commands), but the official
  docs describe them exactly as reusable slash commands.

### Amazon Q Developer CLI saved prompts — SUPPORTED (this round)

- Official docs: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/context-prompt-library.html
- CLI support: aws/amazon-q-developer-cli PR #2799 (global + local prompts).
- Global: `~/.aws/amazonq/prompts/*.md` (flat; invoked as `@name` or via
  `/prompts` in `q chat`).
- Project: `.amazonq/prompts/*.md` (local prompts override global on name
  conflict — Q's own precedence, not AgentMove's concern).
- Plain markdown, no documented frontmatter. Flat scan; nested names are
  flattened with a warning.

## Deferred / rejected

- **Gemini CLI custom commands** (`~/.gemini/commands/*.toml`): TOML-only
  format (`prompt` + `description` fields). Converting normalized markdown
  commands to TOML (or back) is a format conversion, not a byte-faithful
  copy — deferred until a conversion policy is decided (same as ROUND-103).
- **Copilot CLI**: still no documented user-level commands/prompts directory;
  `.github/prompts/*.prompt.md` belongs to other Copilot surfaces.
- **OpenHands microagents**: knowledge triggers, not slash commands (ROUND-102
  decision stands).
