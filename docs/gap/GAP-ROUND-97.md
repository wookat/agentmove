# GAP ROUND-97: Kiro custom agents

## Finding

Kiro (AWS) has first-class custom agents at user and project scope, in both
Markdown and JSON formats. AgentMove's agents layer skipped Kiro with a
"no custom agents directory" warning, which was stale.

## Official evidence

- Kiro docs — Custom agents: https://kiro.dev/docs/custom-agents/
  (https://kiro.dev/docs/agents/ redirects here)
  - Storage: project `.kiro/agents/[name].json|.md`, global
    `~/.kiro/agents/[name].json|.md`; workspace agents take precedence on
    same-name conflicts; nested directories are supported.
  - Both formats support identical fields (`name`, `description`, `tools`,
    `excludedTools`, `includeMcpJson`, `model`, `permissions`, `resources`,
    `welcomeMessage`); "Use Markdown when your system prompt is long …;
    JSON works well for programmatically generated configs".
  - Backward-compatible with IDE 0.x / CLI 2.x JSON configs.

## Decision

- Export/import `~/.kiro/agents/*.md` (user) and `.kiro/agents/*.md`
  (project) byte-faithfully via `readAgentsDir`/`planAgents`.
- JSON agent configs are **not** migrated: `AgentDef` is a portable markdown
  document; converting JSON→markdown would rewrite user files. An honest
  warning lists the skipped `.json` configs and notes Kiro supports the same
  fields in markdown.
- Nested directories are not scanned (flat layer, same boundary as the
  OpenCode decision in round 95).
- Import warning: `tools`/`model`/`permissions` frontmatter is
  client-specific and copied as-is.

## Rejected alternatives

- Auto-converting JSON agents to markdown on export — lossy round-trip risk
  (formatting, field ordering) and silently changes the user's chosen format.
- Recursive scanning of nested agent directories — no other supported client
  needs it; would complicate name collision semantics across clients.
