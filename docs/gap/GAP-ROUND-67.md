# GAP ROUND-67 — JetBrains AI Assistant (43rd client)

## Candidate selected

**JetBrains AI Assistant** (`jetbrains`) — the AI agent platform bundled with
IntelliJ-family IDEs (IntelliJ IDEA, PyCharm, WebStorm, …). Starting with the
2026.x IDE line, the JetBrains AI agents (AI Assistant plus bundled
third-party agents) read a shared file-based MCP configuration.

## Evidence

- **JetBrains' own MPS repository** documents both locations and ships a
  project template file:
  - project: `.ai/mcp/mcp.json` ("Template configuration for MCP servers")
  - user: "You can copy the `.ai/mcp/mcp.json` file to the user home folder as
    e.g. `HOME/.junie/mcp/mcp.json` or `HOME/.ai/mcp/mcp.json`"
  - https://github.com/JetBrains/MPS (README + `.ai/mcp/mcp.json`)
- **openai/codex issue #22461** reproduces PyCharm 2026.1 reading a
  project-level `.ai/mcp/mcp.json` (with per-server logs under the IDE log
  dir's `mcp/` folder).
- **Postman's official JetBrains plugin** writes `~/.ai/mcp/mcp.json` and
  states it is shared by "every JetBrains AI agent that reads MCP — AI
  Assistant, Junie, Codex, Claude, GitHub Copilot for JetBrains".
  https://github.com/postmanlabs/postman-mcp-jetbrains-plugin
- **JetBrains Help (AI Assistant)** documents the `mcpServers` JSON shape
  (stdio `command`/`args`, remote `url`), the *Working directory* field, the
  global/project server level, Streamable HTTP transport, and the
  officially-documented project rules folder `.aiassistant/rules/*.md`:
  - https://www.jetbrains.com/help/ai-assistant/mcp.html
  - https://www.jetbrains.com/help/ai-assistant/configure-project-rules.html

Note: JetBrains Help does not (yet) name the raw file path itself — the path
evidence is first-party-adjacent (JetBrains' own repos + major vendor
integrations reproducing against shipping IDEs). Recorded here honestly.

## Modeling decisions

- User scope: `~/.ai/mcp/mcp.json` `mcpServers` map. Entries have no `type`
  field; stdio uses `command`/`args`/`env` plus native `workingDirectory`
  (round-trips as the bundle's `cwd`), remote uses `url`/`headers`
  (Streamable HTTP). No per-server disabled flag (IDE settings UI toggle) —
  warned. `sse` written as a plain url entry with a warning.
- Project scope (`--project`): `.ai/mcp/mcp.json` plus `.aiassistant/rules/*.md`
  project rules (officially documented). Export merges rule files into one
  document (warned); import writes `.aiassistant/rules/agentmove.md` (rule
  type defaults to Always in the IDE — warned).
- User-level instructions/persona/memory/skills: no file slots (prompt
  library, chat memory are IDE-managed) — skipped with warnings.
- **Junie stays a separate client** (`junie`): separate product with its own
  `~/.junie` tree.

## Candidates rejected/deferred this round

- **JetBrains ACP custom agents** (`~/.jetbrains/acp.json`) — officially
  documented but a different concept (agent launcher registry, not
  MCP/skills/instructions); deferred.
- **Qodo Command** — MCP servers are embedded per-agent inside `agent.toml`
  files; no stable user-level MCP map documented in current docs; deferred.
- **JetBrains AI Assistant IDE-managed settings MCP** (pre-2026 behavior,
  settings-UI only, no file) — superseded by the shared `.ai/mcp/mcp.json`.
