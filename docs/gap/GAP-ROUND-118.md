# GAP-ROUND-118: custom agents layer for Amazon Q Developer CLI

## Evidence

- Agent file locations (official repo docs):
  https://github.com/aws/amazon-q-developer-cli/blob/main/docs/agent-file-locations.md
  - Global agents: `~/.aws/amazonq/cli-agents/*.json`
  - Workspace agents: `.amazonq/cli-agents/*.json`
  - Local (workspace) wins on name conflicts; flat directories.
- Agent format (official technical docs):
  https://aws.github.io/amazon-q-developer-cli/agent-format.html
  - JSON files; the filename stem is the agent name (an optional `name`
    field exists but the filename wins for discovery).
  - Fields: `name`, `description`, `prompt`, `mcpServers`, `tools`,
    `toolAliases`, `allowedTools`, `toolsSettings`, `resources`, `hooks`,
    `useLegacyMcpJson`, `model`.

## Decision

Add the custom agents layer to `amazonq` (user + project scope) via a
**documented lossy conversion** (same policy as the Gemini CLI TOML
commands and goose recipes conversions):

- Export: `description` → single frontmatter line, `prompt` → markdown
  body. Every other field is amazonq-specific and is dropped with a
  per-field warning. Invalid JSON / non-object / prompt-and-description-less
  files are skipped with a warning, never silently.
- Import: markdown agents become `{description, prompt}` JSON files in
  `~/.aws/amazonq/cli-agents/` (project: `.amazonq/cli-agents/`).
  Description-only frontmatter fills the `description` field; frontmatter
  with other fields is kept verbatim inside the prompt (warned). Nested
  names are flattened (`backend/sql` → `backend-sql`, warned; collisions
  skipped).
- amazonq → amazonq round-trips are parse-equivalent for the portable
  fields (description + prompt).

## Deferred (with reasons)

- Mapping agent `mcpServers` to the bundle MCP layer: agent-embedded MCP
  configs are per-agent tool scoping, not the user's MCP config; merging
  them into the global MCP layer would change semantics. Warned instead.
- `hooks` / `toolsSettings` / `resources`: security-sensitive,
  Q-specific execution config; no portable equivalent in `AgentDef`.
- Kiro JSON agent configs remain unmigrated (GAP-ROUND-97 policy):
  Kiro natively supports the same fields in markdown, so the honest
  recommendation stands.
