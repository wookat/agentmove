# GAP-ROUND-91: namespaced skills/<scope>/<name> repository import

## Signal

- GitHub CLI's `gh skill` (v2.90.0+, public preview) discovers skills with
  the conventions `skills/*/SKILL.md` **and** `skills/{scope}/*/SKILL.md`
  (see `gh skill publish` docs), and its flagship example repository —
  `github/awesome-copilot` — uses the namespaced form
  (`skills/monalisa/code-review`).
- agentmove's skills-repository import (ROUND-84) only recognized
  `skills/<name>/SKILL.md`, top-level `<name>/SKILL.md`, and a root
  `SKILL.md`. Namespaced repos were either not detected at all or their
  skills silently missed — exactly the repos `gh skill install owner/repo`
  users will point agentmove at.

## Decision

- `skillDirs()` scans `skills/<x>`: a direct `SKILL.md` keeps the old
  behavior; otherwise one level deeper is checked for
  `skills/<scope>/<name>/SKILL.md`. Direct and namespaced entries mix in one
  repository; hidden directories are skipped at both levels.
- Skill name is the directory basename (matching `gh skill install`, which
  installs by skill name). On a clash across namespaces the later skill is
  imported as `<scope>-<name>` with an honest warning; a still-clashing name
  is skipped with a warning rather than silently overwritten.
- Detection (`isSkillsRepo`) and reading share the same scan, so URL / tree
  URL / archive imports pick the layout up automatically.

## Deferred

- `plugins/{scope}/skills/*/SKILL.md` (plugin-monorepo discovery in
  `gh skill publish`) — such repos are plugin collections; agentmove's
  plugin import handles individual plugins, and tree URLs can target one.
- Deeper nesting (`terraform/code-generation/skills/...` prefix scanning) —
  tree URLs with a subpath already cover it explicitly.
