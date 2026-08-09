# GAP-ROUND-129: Kimi Code CLI generic `~/.agents/skills` root

## Gap before this round

The `kimi` adapter read user skills only from the brand root
`~/.kimi-code/skills/` (project: `.kimi-code/skills/`). Kimi Code CLI
actually merges skills from the brand root **and** the generic shared Agent
Skills root `~/.agents/skills/` (project: `.agents/skills/`), so skills a
user keeps in the cross-client shared root were silently missing from
agentmove exports.

## Upstream evidence (MoonshotAI/kimi-code)

`packages/agent-core/src/skill/scanner.ts`:

```ts
const USER_BRAND_DIRS = ['skills'] as const;          // under ~/.kimi-code (brandHomeDir)
const USER_GENERIC_DIRS = ['.agents/skills'] as const; // under the user home
const PROJECT_BRAND_DIRS = ['.kimi-code/skills'] as const;
const PROJECT_GENERIC_DIRS = ['.agents/skills'] as const;
```

`resolveSkillRoots` pushes roots in the order project-brand → project-generic
→ user-brand → user-generic, and `discoverSkills` registers skills
first-wins by `normalizeSkillName(name)` (lowercase,
`packages/agent-core/src/skill/types.ts`). So on a duplicate name the brand
root wins over the generic root, compared case-insensitively.

The predecessor `MoonshotAI/kimi-cli` (`src/kimi_cli/skill/__init__.py`)
documents the same layered roots (`~/.kimi/skills`, `~/.agents/skills`, ...)
and is being wound down in favor of kimi-code.

## Design in this round

- Export (`readKimiSkills(brandRoot, genericRoot, warnings)`): read the
  brand root, then merge the generic root; duplicate names (lowercased
  comparison) keep the brand copy and warn that the `.agents/skills` copy is
  shadowed. Sorted by name. Used for user scope
  (`~/.kimi-code/skills` + `~/.agents/skills`) and project scope
  (`.kimi-code/skills` + `.agents/skills`).
- Import: unchanged — writes only the brand root (`.kimi-code/skills`),
  which has top priority in kimi's scanner, avoiding double-ownership of the
  shared `.agents/skills` root (owned by other adapters such as muse,
  openhands, amp, grok).

## Honestly deferred

- Flat single-file skills (`<name>.md` directly at a root, no `SKILL.md`
  bundle) — kimi supports them at the top level of a root; agentmove's
  portable `Skill` model is directory-based. Not migrated.
- `$KIMI_CODE_HOME` relocation of the brand home dir; `mergeAllAvailableSkills=false`
  first-root-only mode; `extra_skill_dirs` / `--skills-dir` overrides;
  plugin- and builtin-provided skill roots; sub-skill qualification
  (`has-sub-skill`).

## Test coverage

- Fixture home export: brand `deploy-helper` shadows the `.agents/skills`
  copy (byte check + verbatim warning), generic-only skill exported.
- Case-insensitive duplicate (`Alpha` vs `alpha`): brand wins, warning.
- Imports write only `.kimi-code/skills/` (user and project).
- Project export reads `.agents/skills` too.
