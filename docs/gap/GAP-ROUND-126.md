# GAP-ROUND-126: Amp multi-root user Agent Skills

## Signal

Amp's official manual (https://ampcode.com/manual/agent-skills.md, "Skill
sources and precedence") documents that Amp loads user-level Agent Skills from
multiple roots in priority order, first skill of a given `name` wins:

1. `~/.config/agents/skills/` (also the target of `amp skill add --global`)
2. `~/.agents/skills/`
3. `~/.config/amp/skills/`
4. project `.agents/skills/` (+ searched parent directories)
5. project `.claude/skills/`
6. `~/.claude/skills/`
7. `~/.claude/plugins/cache/`
8. `amp.skills.path` directories
9. built-in skills
10. personal skills repository
11. workspace skills repository

Verified against the shipped CLI binary (`@ampcode/cli` →
`@ampcode/cli-linux-x64` 0.0.1786233956): `strings` on the `amp` binary
contains `~/.config/agents/skills/`, `~/.agents/skills/`,
`~/.config/amp/skills/`, `~/.claude/skills/`, `~/.claude/plugins/cache/`, and
`skills.path`, matching the manual.

## Previous AgentMove behavior

The amp adapter exported user skills only from `~/.agents/skills/` (root 2).
Skills living in `~/.config/agents/skills/` (root 1 — where `amp skill add
--global` installs) or `~/.config/amp/skills/` (root 3) were silently ignored.

## Decision (ROUND-126)

- **User export**: read all three amp-owned user roots in upstream priority
  order (`~/.config/agents/skills/` > `~/.agents/skills/` >
  `~/.config/amp/skills/`); the first skill of a given name wins and each
  shadowed lower-priority copy produces an explicit warning.
- **User import**: keep writing `~/.agents/skills/` (the cross-client shared
  root, priority 2 in amp). If a same-name skill already exists in
  `~/.config/agents/skills/`, warn that it will shadow the imported copy.
- **Project scope**: unchanged — `.agents/skills/` (root 4) is already read
  and written. Parent-directory search is an amp runtime lookup, not a
  migratable store.
- **Not migrated by the amp adapter**: Claude-compatible roots
  (`~/.claude/skills/`, project `.claude/skills/`, `~/.claude/plugins/cache/`)
  belong to the claude adapters; `amp.skills.path` extra directories are
  machine-specific configuration; built-in skills and the personal/workspace
  skills repositories are amp-service-owned Git repositories, not local
  configuration. Documented in limitations.

## Tests

- Fixture roots with a triple-duplicate name proving `~/.config/agents/skills`
  wins and both shadowed copies warn.
- Roots-exclusive skills (`global-only`, `amp-only`, `todo`) all export.
- Import shadow warning fires only for names present in
  `~/.config/agents/skills/`.
