# GAP-ROUND-85: tree URL import (branch + subdirectory)

## Signal

- Deferred from GAP-ROUND-84: the `skills` CLI supports installing a single
  skill by its direct GitHub tree URL
  (`npx skills add https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines`,
  documented in vercel-labs/skills README). Users share skill links in exactly
  this form; agentmove's URL import (ROUND-82/84) only handled whole
  repositories at the default branch.

## Decision

`fetchRemoteInput` now recognizes a GitHub-style tree URL
(`https://host/owner/repo/tree/<branch>[/<subpath>]`):

- clone `https://host/owner/repo` shallow at `--branch <branch>`;
- resolve `<subpath>` inside the clone (path-traversal guarded) and hand that
  directory to the normal detection chain — a directory with a `SKILL.md`
  imports as a single root-SKILL.md skill (ROUND-84), a plugin subdirectory as
  a plugin, etc.;
- a missing subpath (or a file, not a directory) is a data error (exit 3).

Limitations stated honestly in docs: the branch is the first path segment
after `/tree/`, so branch names containing `/` cannot be addressed from the
URL alone (GitHub's own URL scheme is ambiguous there without API calls).

## Deferred

- `blob/<branch>/<file>.json` URLs → could map to raw fetch; revisit on demand.
- `owner/repo` shorthand — still ambiguous with relative local paths.
