# GAP-ROUND-86: GitLab tree URLs + blob→raw rewriting

## Signal

- ROUND-85 e2e testing flagged that the tree-URL grammar required exactly
  host + owner/repo before `/tree/`, so GitLab subgroup URLs
  (`host/group/subgroup/repo/-/tree/…`) could not be addressed.
- Deferred from GAP-ROUND-85: users paste web `blob` file links
  (`github.com/o/r/blob/main/team-mcp.json`) which previously fetched the HTML
  page and failed with a parse/data error instead of the config file.

## Decision

- `parseTreeUrl` also recognizes GitLab-style `…/-/tree/<branch>[/<subpath>]`;
  the explicit `/-/` marker makes the repo boundary unambiguous, so nested
  subgroups work. GitHub-style `…/tree/…` (two-segment repo base) unchanged.
- New `rewriteBlobUrl` applied to `.json` URL fetches:
  `github.com/<o>/<r>/blob/<ref>/<path>` → `raw.githubusercontent.com/<o>/<r>/<ref>/<path>`;
  any `…/-/blob/…` → `…/-/raw/…`. Other URLs pass through untouched. HTTP
  errors report the rewritten URL for transparency.

## Deferred

- Bitbucket `src/<ref>/<path>` URLs — no observed demand yet.
- GitHub slash-branch disambiguation via API — out of scope for a no-auth CLI.
