# GAP-ROUND-115: commands layer for Kiro (saved prompts)

## Gap

Kiro's `kiro-cli` chat supports **saved prompts**: flat markdown files invoked
as `@prompt-name`. AgentMove already migrated Kiro MCP, steering, skills, and
custom agents, but not prompts — a user moving to/from Kiro lost their prompt
library.

## Evidence

Official docs:

- Manage prompts: <https://kiro.dev/docs/cli/chat/manage-prompts/> —
  global prompts live in `~/.kiro/prompts/`, project prompts in
  `.kiro/prompts/`, invoked as `@prompt-name`; created via
  `/prompts create --name <name>`; local (file-based) prompts do **not**
  support arguments; local prompts take precedence over MCP prompts, and
  workspace prompts override global ones with the same name.
- File references: <https://kiro.dev/docs/cli/chat/file-references/> —
  `@name` resolves to a prompt when it matches a known prompt.

Upstream source (kiro-cli is derived from the open-source Amazon Q Developer
CLI; Kiro's prompt manager keeps the same loader semantics with the `.kiro`
paths):

- `crates/chat-cli/src/cli/chat/cli/prompts.rs` — prompts are discovered with
  a non-recursive `fs::read_dir`, only files with the `md` extension are
  loaded, and prompts are saved as `<name>.md`.

## Fix (this round)

- `kiro` adapter: `supportsCommands: true`; export reads
  `~/.kiro/prompts/*.md` byte-faithfully (flat, `.md` only); import plans flat
  writes via `planCommandsFlat` (nested names like `git/commit` flattened to
  `git-commit` with a warning) plus an honest warning that prompts are invoked
  as `@name` with no argument support.
- Project scope: `.kiro/prompts/` export/import with the same semantics.
- MCP prompts (runtime, server-provided) are not files and are not migrated.

## Deferred (with evidence)

- **Antigravity workflows**: search results conflict between
  `.agents/workflows/` and `.agent/workflows/` and no authoritative official
  doc or source was found this round — deferred rather than guessed.
