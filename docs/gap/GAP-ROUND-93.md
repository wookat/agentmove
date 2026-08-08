# GAP ROUND-93 — Gemini CLI Agent Skills support

## Signal

- Gemini CLI (google-gemini/gemini-cli) shipped Agent Skills support; v0.29.0
  (2026-02-18) release notes include multiple `feat(skills)` changes (skill
  linking, lifecycle docs, reload on extension restart).
- Official docs (`docs/cli/using-agent-skills.md`, geminicli.com tutorials)
  document discovery precedence: built-in → extension → user
  (`~/.gemini/skills/` or the `~/.agents/skills/` alias) → workspace
  (`.gemini/skills/` or `.agents/skills/`).
- Our `gemini` adapter still carried the pre-skills behavior from early
  rounds: "Gemini CLI has no SKILL.md mechanism; skipped" — now factually
  stale, same class of fix as ROUND-81 (VS Code) and ROUND-83 (Claude
  Desktop).

## Decisions

- **User scope: write `~/.gemini/skills/`** (the brand-native directory)
  rather than the `~/.agents/skills/` alias. The alias is shared with
  codex/zed/amp/vscode/muse adapters; writing the native dir avoids
  double-ownership on later exports. Reading also uses `~/.gemini/skills/`
  only — skills a user keeps in the alias root are already covered by the
  clients that own that root.
- **Project scope: `.gemini/skills/`** added to the existing gemini project
  adapter (settings.json + GEMINI.md unchanged). Workspace-trust gating is a
  runtime concern of the CLI, not of file migration.
- **Xcode Gemini unchanged**: Xcode 26's bundled Gemini snapshot has no
  documented skills discovery; `makeGeminiStyleAdapter` gained an optional
  `skillsDir` and `xcode-gemini` omits it, keeping the honest skip warning.
- Discovery deeper than one level is not supported by Gemini CLI (documented),
  matching our standard `readSkillsDir`/`planSkills` layout.

## Rejected this round

- Copilot CLI GA plugins (`/plugin install`) — plugin install state is
  client-managed (registry metadata), not a portable file surface beyond the
  Agent Plugins interop we already ship.
- VS Code "agent plugins from Extensions view" — marketplace-managed install,
  no stable user-level file contract yet.

## Also fixed

- `limitations.md` still listed VS Code and Claude Desktop under "no
  user-level skills directory" despite ROUND-81/83 adding native support —
  stale bullet corrected.
