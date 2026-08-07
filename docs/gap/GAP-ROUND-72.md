# GAP-ROUND-72 — Agent Skills for Zed and Continue

## Trigger

Continuing the Agent Skills ecosystem sweep (rounds 69–71: Cursor, Copilot
CLI, Windsurf, Cline, Warp): both Zed and Continue now officially document
Agent Skills (`SKILL.md`) support, making our old skip warnings stale.

## Official evidence

### Zed

- Docs: https://zed.dev/docs/ai/skills
- Source: https://github.com/zed-industries/zed/tree/main/crates/agent_skills
  (implements the https://agentskills.io/specification spec: `SKILL.md` with
  required `name`/`description` frontmatter, optional `scripts/`,
  `references/`, `assets/`).
- Install locations documented: global `~/.agents/skills/`, project
  `.agents/skills/`.

Decision: read/write `~/.agents/skills/` (user) and `.agents/skills/`
(project). These are shared Agent Skills roots (also used by codex/amp/goose
adapters), which matches Zed's documented canonical location — Zed has no
Zed-specific skills directory.

The old warning ("zed skills are app-managed (Rules Library/Skills);
skipped") predates this and is removed. Rules Library entries remain
app-managed and are still not migrated.

### Continue

- CLI feature: continuedev/continue PR #9696 (`feat(cli): agent skills`) and
  PR #11113 (invokable skills, `/skills`, `/import-skill` saving into
  `~/.continue/skills/<name>/`).
- IDE extensions: PR #9353 (`feat: agent skills`) loads `SKILL.md` from
  `.continue/skills/` and `.claude/skills/` (workspace and global).
- Documented locations: `$CONTINUE_HOME/skills/` (defaults to
  `~/.continue/skills/`), project `.continue/skills/` (`.claude/skills/`
  also read for compatibility).

Decision: read/write `~/.continue/skills/` (user) and `.continue/skills/`
(project) — the Continue-canonical paths — so a later `export continue` can
attribute the skills to Continue.

## Deferred candidates (unchanged)

VS Code, Claude Desktop, Amazon Q Developer CLI, LM Studio, and JetBrains AI
Assistant still have no officially documented stable Agent Skills directory;
their skip warnings remain until official evidence appears.
