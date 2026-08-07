# GAP-ROUND-70: GitHub Copilot CLI + Windsurf Agent Skills

## Selected: native Agent Skills migration for Copilot CLI and Windsurf

Two clients we previously marked as "no SKILL.md mechanism" now officially
support the Agent Skills standard (`<name>/SKILL.md` directories).

### GitHub Copilot CLI — official evidence

- Docs: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills
  ("Adding agent skills for GitHub Copilot CLI")
- Personal skills: `~/.copilot/skills/` (or `~/.agents/skills/`)
- Project skills: `.github/skills/` (or `.claude/skills/`, `.agents/skills/`)
- `SKILL.md` with YAML frontmatter (`name`, `description` required); scripts
  and resources in the same directory.
- GitHub Changelog 2026-04-16 launched `gh skill` for cross-agent skill
  management, confirming the convention.

Decision: read/write the Copilot-specific paths `~/.copilot/skills/` (user)
and `.github/skills/` (project) so a later `export copilot` can attribute the
skills to Copilot rather than the shared `.agents/skills` root.

### Windsurf — official evidence

- Docs: https://docs.devinenterprise.com/desktop/cascade/skills
  (Cascade Skills; Windsurf is part of Cognition)
- Global skills: `~/.codeium/windsurf/skills/`
- Workspace skills: `.windsurf/skills/`
- Same `SKILL.md` + frontmatter + supporting-files layout; also discovers
  `.agents/skills/` for cross-agent compatibility.

Decision: read/write `~/.codeium/windsurf/skills/` (user) and
`.windsurf/skills/` (project).

## Changes

- `adapters/copilot.ts`: export reads `~/.copilot/skills/`; import plans
  skills there; stale "no SKILL.md mechanism" warning removed.
- `adapters/windsurf.ts`: export reads `~/.codeium/windsurf/skills/`; import
  plans skills there; stale warning removed.
- `project.ts`: copilotProject and windsurfProject export/import
  `.github/skills/` and `.windsurf/skills/` respectively.
- Fixtures, tests, README, website clients/limitations/commands docs updated.

## Deferred / rejected this round

- Cline / Zed / VS Code / Continue / Claude Desktop / Amazon Q / Warp /
  LM Studio / JetBrains AI Assistant: no official user-level skills directory
  found yet; keep skip warnings.
- Shared `.agents/skills` fallback discovery for these clients: reading the
  shared root from a client-specific exporter would mis-attribute ownership;
  Codex/Amp/goose already cover the shared root.
