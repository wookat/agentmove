# GAP ROUND-101: Kimi Code CLI custom agents

## Research

Official docs (source of truth):

- https://www.kimi.com/code/docs/en/kimi-code-cli/customization/sub-agents.html

Kimi Code CLI discovers custom agent markdown files (YAML frontmatter +
system-prompt body) by scope, priority Explicit (`--agent-file`) > Project >
Extra > User > Plugin > Built-in. Each directory is **scanned recursively**
for `.md` files.

- User level: `$KIMI_CODE_HOME/agents/` (default `~/.kimi-code/agents/`) plus
  the generic shared root `~/.agents/agents/` (stays under the real OS home so
  it can be shared across tools).
- Project level: `.kimi-code/agents/` and `.agents/agents/`.
- Extra directories (`extra_agent_dirs` in `config.toml`), plugin agents, and
  `--agent-file` launches are configuration/runtime concerns — not migrated.

Documented frontmatter fields: `name` (defaults to filename), `description`
(required), `whenToUse`, `override` (may replace a same-name built-in),
`model_preference` (`primary`/`secondary`), `tools`, `disallowedTools`,
`subagents`.

## Decision

Add a recursive reader `readAgentsDirRecursive` (subdirectory paths become
part of the agent name, e.g. `team/planner`, so the relative layout
round-trips) plus `mergeAgentLists` (later list wins by name). Kimi exports
merge `~/.agents/agents/` then `~/.kimi-code/agents/` (brand dir wins on
name conflicts; docs list it first within the user scope), byte-faithful.
Imports write only the brand-native `.kimi-code/agents/` directory to avoid
double-ownership of the shared `~/.agents/agents/` root (same reasoning as
the Gemini skills decision in ROUND-93). Project scope mirrors this with
`.kimi-code/agents/` + `.agents/agents/`.

Honest warning on import: `tools`/`disallowedTools`/`subagents`/
`model_preference`/`override` frontmatter is client-specific and copied
as-is. `$KIMI_CODE_HOME` relocations are not followed (consistent with the
existing skills behavior). `extra_agent_dirs`, plugin agents, built-ins, and
`--agent-file` definitions are honestly not migrated.

This was deferred in ROUND-100 because the flat `readAgentsDir` helper could
not express recursive discovery or the dual user roots; the new helpers make
both explicit.
