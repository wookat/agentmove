# GAP-ROUND-107: commands layer for Kilo Code and Cline

Round 107 extends the portable commands / custom prompts layer to Kilo Code
and Cline, based on official documentation and source.

## Kilo Code

- Docs: https://kilo.ai/docs/customize/workflows
- Global commands: `~/.config/kilo/commands/*.md` (flat; invoked as
  `/command-name`, filename without `.md`).
- Project commands: `.kilo/commands/*.md`.
- Legacy locations `~/.kilocode/workflows/` and `.kilocode/workflows/` are
  auto-migrated by the extension on startup; AgentMove still reads them on
  export (new location wins on name conflicts, warned) but imports write only
  the new location.
- Frontmatter: `description`, `agent`, `model`, `subtask` — client-specific,
  copied as-is with a warning.

## Cline

- Docs: https://www.mintlify.com/cline/cline/customization/workflows and
  https://cline.bot/blog/stop-adding-rules-when-you-need-workflows
- Source: `src/core/storage/disk.ts` (`workflows: ".clinerules/workflows"`,
  `ensureWorkflowsDirectoryExists` → `<Documents>/Cline/Workflows`).
- Global workflows: `~/Documents/Cline/Workflows/*.md` (flat; invoked as
  `/name.md`).
- Workspace workflows: `.clinerules/workflows/*.md` (project scope; take
  precedence over global on name match — client behavior, not migrated
  state).
- Non-markdown workflow files (`.txt`, extensionless) are supported by the
  client but are not migrated (warned per file).
- Enable/disable toggles are app-managed state and not migrated.

## Deferred (unchanged from GAP-ROUND-106)

- Kimi Code CLI: commands ship via plugins only — no user commands dir.
- Gemini CLI: TOML-only custom commands — a lossy format conversion, not a
  byte-faithful copy; deferred.
- Copilot CLI: prompts path undocumented; deferred.
- Trae: IDE/CLI command paths disagree across docs; deferred.
