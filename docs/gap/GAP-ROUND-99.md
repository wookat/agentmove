# GAP ROUND-99 — Custom agents layer for CodeBuddy

## Evidence (official docs)

- https://www.codebuddy.ai/docs/cli/sub-agents — CodeBuddy Code sub-agents are
  markdown files with YAML frontmatter. User scope `~/.codebuddy/agents/`,
  project scope `.codebuddy/agents/`; project takes priority on name conflicts.
- https://www.codebuddy.ai/docs/cli/codebuddy-dir — directory structure: each
  agent is a single `.md` file in the flat `agents/` directory; project
  `.codebuddy/agents/` is recommended for VCS commit.
- https://www.codebuddy.ai/docs/ide/Features/Subagents — IDE uses the same
  file locations.

## Documented frontmatter

`name`, `description`, `tools`, `disallowedTools`, `model`, `effort`,
`maxTurns`, `background`, `initialPrompt`, `memory`, `mcpServers` — the
non-universal ones are client-specific; AgentMove copies them as-is with an
honest warning (`tools/model/effort/maxTurns/memory/mcpServers`).

## Not migrated (honest)

- CLI `--agents` JSON definitions are session-only (no on-disk file) — nothing
  to migrate.
- Plugin-provided agents live inside plugin packages — out of scope for the
  agents layer.
- Agent memory (`~/.codebuddy/agent-memory/`) is runtime data — not migrated.

## Decision

Reuse `readAgentsDir`/`planAgents` for `~/.codebuddy/agents/*.md` (user) and
`.codebuddy/agents/*.md` (project, via `--project`), byte-faithful, with the
client-specific frontmatter warning. `supportsAgents: true` on both adapters.
