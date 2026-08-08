# GAP-ROUND-106 — commands layer for Qoder CLI and Roo Code

## Qoder CLI custom commands

Official docs: https://docs.qoder.com/cli/commands

- User-level: `~/.qoder/commands/`
- Project-level: `.qoder/commands/`
- Markdown files with optional frontmatter (`name` is display-only; the
  invocation name derives from the file path; `description` shows in the TUI).
- Subdirectories become `:`-separated namespaces:
  `commands/git/commit.md` → `/git:commit` — nested layouts are preserved
  by AgentMove (same treatment as CodeBuddy / Claude Code / Qwen).
- Frontmatter is client-specific; copied as-is with a warning.

## Roo Code custom slash commands

Official docs: https://docs.roocode.com/features/slash-commands

- Global: `~/.roo/commands/`
- Project: `.roo/commands/` (project overrides global on name conflicts)
- Flat markdown files; the filename (sans `.md`) becomes the `/name`.
  Roo's Settings UI slugs names (lowercase, spaces→dashes); files created
  externally are used as-is.
- Frontmatter: `description`, `argument-hint`, `mode` — client-specific;
  copied as-is with a warning.
- Flat scan only → nested bundle names are flattened (`git/commit` →
  `git-commit`) with a warning, consistent with Cursor/Codex/Windsurf/Amazon Q.

## Deferred (unchanged from earlier rounds)

- **Kimi Code CLI**: slash commands exist only via plugins
  (`kimi.plugin.json` `commands` field) and built-in/skill commands —
  no standalone user commands directory documented. Deferred.
- **Gemini CLI**: commands are TOML-only (`~/.gemini/commands/*.toml`);
  Markdown → TOML conversion would not be byte-faithful. Deferred.
- **Kilo Code**: commands/workflows layout mid-migration
  (`.kilocode/workflows/` vs `.kilo/commands/`); docs and source disagree.
  Deferred until stable.
- **Copilot CLI**: no authoritative documented prompts directory. Deferred.
- **Trae IDE** has `.trae/commands/` (IDE) but the TraeCode CLI documents
  `.traecli/commands/` — the two surfaces disagree on the project directory
  and no user-level directory is documented; deferred pending clarity.
