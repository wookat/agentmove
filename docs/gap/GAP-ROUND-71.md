# GAP-ROUND-71 — Agent Skills for Cline and Warp

## Trigger

Continuing the Agent Skills ecosystem sweep from rounds 69 (Cursor) and 70
(Copilot CLI + Windsurf): both Cline and Warp now officially document Agent
Skills (`SKILL.md`) directories, making our old skip warnings stale.

## Official evidence

### Cline

- Docs: https://docs.cline.bot/customization/skills
- Skills are directories containing a `SKILL.md` with YAML frontmatter
  (`name` must match the directory name, `description` up to 1024 chars),
  plus optional `docs/`, `templates/`, `scripts/` supporting files.
- Locations: project `.cline/skills/` (recommended) or `.clinerules/skills/`
  (alternate); global `~/.cline/skills/`.
- The cline/skills community repo (https://github.com/cline/skills) confirms
  `~/.cline/skills/` as the global install target and cites the Agent Skills
  spec.

Decision: read/write `~/.cline/skills/` (user) and `.cline/skills/` (project).
The `.clinerules/skills/` alternate is not written (one canonical target;
Cline reads both).

### Warp

- Docs: https://docs.warp.dev/agent-platform/capabilities/skills/
- Skills are directories with a `SKILL.md`; supporting files referenced from
  it. Project locations include `.agents/skills/` (recommended),
  `.warp/skills/`, `.claude/skills/`, and others; global locations include
  `~/.agents/skills/` (recommended), `~/.warp/skills/`, etc.
- The old adapter warning ("warp skills are app-bundled, not user files") is
  therefore stale.

Decision: read/write the Warp-specific paths `~/.warp/skills/` (user) and
`.warp/skills/` (project) so a later `export warp` can attribute the skills
to Warp rather than the shared `.agents/skills` root (same reasoning as
rounds 69–70).

## Deferred candidates (unchanged)

Zed, VS Code, Continue, Claude Desktop, Amazon Q Developer CLI, LM Studio,
and JetBrains AI Assistant still have no officially documented stable Agent
Skills directory; their skip warnings remain until official evidence appears.
