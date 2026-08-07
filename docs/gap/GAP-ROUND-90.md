# GAP-ROUND-90: strip gh install-tracking metadata on --skills-repo export

## Signal

- GitHub CLI's `gh skill install` (v2.90.0+, public preview) injects
  source-tracking metadata into each installed SKILL.md's frontmatter
  `metadata:` map — `github-repo`, `github-ref`, `github-tree-sha`,
  `github-path`, `github-pinned` (see `internal/skills/frontmatter` in
  cli/cli) — so `gh skill update` can detect changes.
- `gh skill publish` *rejects* skills that still carry `metadata.github-*`
  keys; users must run `gh skill publish --fix` to strip them.
- ROUND-89's `--skills-repo` export copied skills byte-for-byte, so exporting
  a skill that was originally installed via `gh skill install` produced a
  repository that fails `gh skill publish` validation out of the box.

## Decision

- `writeSkillsRepo` now runs each skill's root `SKILL.md` through
  `stripInstallMetadata()`: a line-based pass over the frontmatter that
  removes `github-*` keys (and their nested continuation lines) under the
  top-level `metadata:` map, dropping the `metadata:` line itself when it
  ends up empty. Everything else stays byte-identical; files without install
  metadata are untouched.
- Each stripped skill emits an honest warning
  (`skill:<name>: stripped gh install-tracking metadata …`).
- Only the `--skills-repo` (publishing) path strips; bundles and Agent
  Plugins remain byte-faithful transports.

## Deferred

- Full agentskills.io naming/frontmatter validation — still owned by
  `gh skill publish --dry-run`.
- Stripping other tools' tracking metadata — no other prefix is standardized;
  revisit if the ecosystem grows more.
