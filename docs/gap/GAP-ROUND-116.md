# GAP-ROUND-116: commands layer for Antigravity (workflows)

## Gap

Antigravity workflows (saved prompts triggered as `/name` slash commands) were
not covered by the portable commands layer. GAP-ROUND-115 deferred them because
evidence at the time conflicted on the workspace path (`.agents/workflows/` vs
`.agent/workflows/`).

## Evidence (resolved)

- Google Codelabs (official): "Antigravity natively understands workflow files
  placed in the `.agents` directory" — workspace workflows live in
  `.agents/workflows/*.md` and register `/name` slash commands.
  https://codelabs.developers.google.com/autonomous-ai-developer-pipelines-antigravity
- Mete Atamel (Google), "Where does Antigravity look for Rules and Workflows?"
  (2026-07-13): for all 3 flavours (AGY, AGY CLI, AGY IDE):
  - Workspace workflows: `.agents/workflows/`
  - Global workflows: `~/.gemini/config/global_workflows/`
  - "They are simply markdown files" — one `.md` file per workflow; the slash
    command is the filename (e.g. `global-workflow.md` → `/global-workflow`).
  - AGY CLI: "for workflows, there's no way to trigger them with a `/` in the
    chat" — the CLI lists them but cannot trigger them.
  https://atamel.dev/posts/2026/07-13_where_agy_rules_workflows/

The `.agent/workflows/` variant found earlier is not corroborated by any
official source; `.agents/workflows/` is confirmed by both sources above.

## Implementation

- User-level export: flat scan of `~/.gemini/config/global_workflows/*.md`
  (no nesting is documented), byte-faithful contents.
- User-level import: `planCommandsFlat` into
  `.gemini/config/global_workflows/` — nested names flattened with a warning,
  post-flatten collisions skipped with a warning; honest warning that
  workflows are triggered as `/name` in AGY and AGY IDE while AGY CLI lists
  them but cannot trigger them.
- Project scope: `.agents/workflows/` export/import with the same semantics.
- Rules, skills, MCP, and GEMINI.md ownership are unchanged.

## Not migrated / out of scope

- Built-in slash commands (`/goal`, `/grill-me`, `/schedule`, `/browser`) are
  product features, not user files.
- Rules remain part of the instructions layer (unchanged).
