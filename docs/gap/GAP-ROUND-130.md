# GAP-ROUND-130: OpenCode multi-root Agent Skills

## Gap

AgentMove's opencode adapter only read `~/.config/opencode/skills/`
(project: `.opencode/skills/`). Upstream OpenCode discovers skills from
several more roots, so skills a user actually has loaded in opencode were
invisible to `agentmove export opencode`.

## Upstream evidence

`packages/opencode/src/skill/index.ts` (sst/opencode):

```ts
const CLAUDE_EXTERNAL_DIR = ".claude"
const AGENTS_EXTERNAL_DIR = ".agents"
const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
const OPENCODE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
```

- External user roots: `~/.claude/skills/` and `~/.agents/skills/` (plus the
  same directories walked up from the working dir for project scope).
- OpenCode config directories are scanned with `{skill,skills}/**/SKILL.md`,
  i.e. both `skills/` and the singular `skill/`.

`packages/opencode/src/config/paths.ts`:

```ts
return unique([
  Global.Path.config,                                   // ~/.config/opencode
  ...afs.up({ targets: [".opencode"], start: directory, stop: worktree }), // project .opencode
  ...afs.up({ targets: [".opencode"], start: Global.Path.home, stop: Global.Path.home }), // ~/.opencode fallback
  ...(Flag.OPENCODE_CONFIG_DIR ? [Flag.OPENCODE_CONFIG_DIR] : []),
])
```

Duplicate names: opencode keys skills by frontmatter `name`, logs a
"duplicate skill name" warning and keeps one entry; which copy wins is
load-order dependent (matches are loaded concurrently).

## Fix (this round)

- User export merges, in priority order (first name wins, shadowed copies
  warned): `~/.config/opencode/skills`, `~/.config/opencode/skill`,
  `~/.opencode/skills`, `~/.opencode/skill`, `~/.agents/skills`.
- Project export merges `.opencode/skills`, `.opencode/skill`,
  `.agents/skills` with the same semantics.
- Imports keep writing only `~/.config/opencode/skills/` (project:
  `.opencode/skills/`).

## Deferred (honest limitations)

- `~/.claude/skills/` (also scanned by opencode) belongs to the claude
  adapters and is not read here, matching the amp precedent.
- Nested skill directories (`**/SKILL.md` below one level), configured
  `skills.path` entries, skill URLs, and `OPENCODE_CONFIG_DIR` relocations
  are not migrated.
- Our deterministic first-root-wins pick may differ from opencode's
  load-order-dependent duplicate resolution; the warning names both copies.
