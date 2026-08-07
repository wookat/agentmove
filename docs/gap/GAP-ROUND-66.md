# GAP-ROUND-66: Xcode 26 coding intelligence (xcode-claude / xcode-codex / xcode-gemini)

## Selected: Xcode's bundled agents (40th–42nd clients)

Xcode 26 ships "coding intelligence" with three bundled agents — Claude Agent,
Codex, and Gemini — each with an **isolated config root** under
`~/Library/Developer/Xcode/CodingAssistant`, separate from the standalone
CLIs' `~/.claude` / `~/.codex` / `~/.gemini`.

### Official evidence

- Apple, "Extending and customizing agents"
  (developer.apple.com/documentation/xcode/extending-and-customizing-agents):
  "Place the configuration files in agent-specific subfolders in the
  `~/Library/Developer/Xcode/CodingAssistant` folder that Xcode uses
  exclusively. For example, place Claude Agent, Codex, and Gemini
  configuration files in the following folders:
  `~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig`,
  `~/Library/Developer/Xcode/CodingAssistant/codex`,
  `~/Library/Developer/Xcode/CodingAssistant/gemini`" — and "you can set a
  default model, add additional Model Context Protocol (MCP) servers, and
  create your own skills" via these files.
- Apple, "Setting up coding intelligence" and "Giving agentic coding tools
  access to Xcode": external agents connect to Xcode over `xcrun mcpbridge`
  (`claude mcp add --transport stdio xcode -- xcrun mcpbridge`,
  `codex mcp add xcode -- xcrun mcpbridge`) — evidence that the bundled
  agents use the standalone CLIs' own file formats.

### Design decisions

- The file formats are exactly the standalone CLIs' formats, so the three
  adapters are built from factories extracted from the existing
  `claude-code`, `codex`, and `gemini` adapters (`makeClaudeStyleAdapter`,
  `makeCodexStyleAdapter`, `makeGeminiStyleAdapter`) with the config root
  parameterized. Behavior, merge semantics, and lossy edges stay identical
  and covered by the same code paths.
- `xcode-claude` root acts as the agent's home: `.claude.json` +
  `.claude/CLAUDE.md` + `.claude/skills/` inside `ClaudeAgentConfig/`.
- `xcode-codex` root acts as the agent's `CODEX_HOME`: `config.toml` +
  `AGENTS.md` directly inside `codex/`. Codex CLI's Agent Skills live in
  `~/.agents/skills`, which is a home-level path with no documented Xcode
  equivalent — imported skills are **skipped with a warning**.
- `xcode-gemini` root acts as the agent's `.gemini` dir: `settings.json` +
  `GEMINI.md` (including the "Gemini Added Memories" section) directly
  inside `gemini/`.
- macOS-only paths: on other platforms doctor simply won't detect these
  clients. `defaultPath` is annotated "(macOS)".
- Project scope: Xcode agents read the shared project-level files
  (`.mcp.json`, `AGENTS.md`, `CLAUDE.md`) that the standalone adapters
  already migrate — no separate project adapters are added; docs point users
  at the standalone ids with `--project`.
- Community reports (third-party, unconfirmed) suggest Xcode may gate custom
  user-level MCP servers behind a feature flag in some 26.x builds; noted in
  docs as a caveat with cautious wording, not modeled in code.

## Rejected / deferred candidates this round

- **Sketch**: ships an MCP *server* (`sketch-mcp-bundle`), not an agent
  client with a migratable config file — out of scope.
- **Chatbox**: MCP support exists but configuration is app-managed in the
  renderer settings store; no stable user-editable config file documented.
- **Msty**: MCP ("toolbox") configuration is app-managed; no stable file.
- **JetBrains AI Assistant**: global/project MCP configuration exists in the
  IDE UI, but official docs do not document a stable raw file path
  (settings live in IDE options XML) — deferred pending documentation.
- **Air**: `acp.json` agent configuration exists, but MCP config file
  details are not yet documented — deferred.
