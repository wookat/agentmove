# GAP-ROUND-84: skills repository import (skills.sh ecosystem)

## Signal

- The `skills` CLI (vercel-labs/skills, `npx skills add owner/repo`) has become
  the de-facto distribution channel for Agent Skills: Vercel documents an
  official skills directory at skills.sh (vercel.com/docs/agent-resources/skills),
  and Google's new `google-agents-cli` officially instructs
  `npx skills add google/agents-cli` as an install path
  (google.github.io/agents-cli/guide/getting-started/).
- These skill repositories are plain git repos carrying `SKILL.md` directories —
  they are **not** Agent Plugins (no `plugin.json`) and not agentmove bundles
  (no `manifest.json`), so agentmove's URL import (ROUND-82) failed on them
  with "not an agentmove bundle (missing manifest.json)".

## Layouts observed in the wild

| Layout | Example |
|---|---|
| `skills/<name>/SKILL.md` | vercel-labs/agent-skills, google/agents-cli |
| `<name>/SKILL.md` at top level | anthropics/skills-style repos |
| single root `SKILL.md` | one-skill repos; `skills add` supports direct tree URLs |

## Decision

`import <client> -i <dir-or-url>` now auto-detects a **skills repository** as a
last resort before the bundle fallback: a directory without `plugin.json` /
`manifest.json` that carries `SKILL.md` in one of the three layouts above. Only
directories that actually contain a `SKILL.md` are imported (repo sources, docs,
hidden dirs are ignored). A root `SKILL.md` skill is named from its frontmatter
`name:` (falling back to the directory basename, which for a cloned URL would
be the temp dir name). An honest warning reports the detection and skill count.

## Deferred

- `owner/repo` GitHub shorthand (as `skills add` accepts) — ambiguous with
  relative local paths; URL form covers the need.
- Direct `tree/<branch>/<subpath>` GitHub URLs — requires URL rewriting to
  raw fetches or sparse checkout; revisit on demand.
- skills-lock.json / update semantics — package-manager territory, out of scope
  for a migration tool.
