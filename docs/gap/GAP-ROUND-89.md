# GAP-ROUND-89: skills repository export (--skills-repo)

## Signal

- GitHub CLI now ships `gh skill publish`: validates a local repository's
  skills against the Agent Skills specification (`skills/*/SKILL.md` and
  related layouts) and publishes them as a GitHub release — skills-repo
  publishing is becoming a first-class, officially tooled workflow.
- The wider ecosystem (`npx skills add`, `publish-skills`, `skills export`)
  all standardize on the `skills/<name>/SKILL.md` repository layout.
- agentmove could *import* skills repositories since ROUND-84 but had no way
  to *produce* one: skills only came out inside bundles or Agent Plugins,
  so users publishing their skills had to copy files by hand.

## Decision

- `export <client> --skills-repo <dir>` (an also-write side output, like
  `--mif` and `--mcp-json`) writes the bundle's skills as
  `skills/<name>/SKILL.md` — the nested layout every consumer recognizes,
  including agentmove's own skills-repository import (lossless round-trip).
- A `--skills-repo` path ending in `.zip`/`.tgz`/`.tar.gz` stages the repo in
  a temp directory and packages it with the ROUND-88 `createArchive()`
  (one top-level directory named after the file minus the suffix).
- A client with no skills is a data error (exit 3, `no skills to export`) —
  an empty skills repo is undetectable and unusable downstream.

## Deferred

- Frontmatter validation against the strict agentskills.io naming rules —
  `gh skill publish --dry-run` already owns validation; duplicating it here
  risks drift.
- Auto-creating the git repository / release — `gh skill publish` and
  `publish-skills` own that half of the workflow.
