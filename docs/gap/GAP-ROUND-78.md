# GAP ROUND-78 — Agent Plugins launch-window guide (docs round)

## Trigger

Agent Plugins 1.0.0 launched 2026-08-06 with immediate client support across
ChatGPT/Codex, Cursor, GitHub Copilot, Kiro, and VS Code
([Vercel changelog](https://vercel.com/changelog/introducing-agent-plugins-1-0-0)).
AgentMove shipped both directions of the format in v0.48.0 (ROUND-77 / PR #138),
but the website had no guide surfacing it — the launch window is the moment
users search for "how do I package my agent as a plugin".

## What this round ships

- New website guide `docs/agent-plugins.md` ("Package your agent as an Agent
  Plugin"), added to the Guides sidebar next to the Gemini→Antigravity
  migration guide. Every claim on the page was verified with the real CLI in a
  temp home (claude-code fixture → `export --plugin` produced exactly
  `plugin.json` + `mcp.json` + `skills/review/SKILL.md`, with redaction and the
  instructions-lossy warning as documented).

## Candidates evaluated and deferred

- **Codex plugin marketplaces** (`~/.agents/plugins/marketplace.json` +
  `~/.codex/plugins/`): install/distribution is explicitly client-owned per the
  Agent Plugins spec; the marketplace file is a catalog of *sources*, not agent
  configuration, and its docs are currently self-contradictory about the
  marketplace root (openai/codex#16500). Not a migration surface yet.
- **MCP 2026-07-28 stateless spec**: removes the transport handshake and
  session header — a server/runtime concern with no client config-file changes;
  nothing for AgentMove to translate.

Docs-only round: no changeset.
