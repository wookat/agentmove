# GAP-ROUND-63: Gemini CLI → Antigravity migration guide

## This round

- Website guide page `docs/gemini-to-antigravity` capitalizing on the
  2026-06-18 Gemini CLI consumer retirement (demand spike, supply gap):
  documents the exact `convert gemini antigravity` path, what moves
  (MCP servers, settings.json → mcp_config.json serverUrl notation),
  what stays in place (`~/.gemini/GEMINI.md` is read by both), redaction,
  merge semantics, and encrypted-bundle machine moves.
- Verified against the real CLI (dry-run + `--apply` on a temp home).

## Candidate research (no new adapter this round)

- **Jules / Jules Tools (`@google/jules`)**: rejected — the CLI is a remote
  session controller; MCP servers are app-managed in the Jules web Settings
  (jules.google docs, changelog 2026-02-02). No stable local config to
  migrate.
- **MiniMax CLI (`mmx`)**: rejected — a media-generation platform CLI
  (text/image/video/speech), not a coding agent harness; `~/.mmx/config.json`
  holds platform prefs, no MCP/skills/instructions layers.
- **DeepSeek CLIs** (`yinshuo-thu/deepseek-cli`, `deepseek-agent`,
  DeepSeek TUI, DeepSeekCode): rejected for now — all unofficial community
  projects with small adoption and unstable configs; revisit if DeepSeek
  ships an official agent CLI.
- **Sketch MCP**: not a client — it is an MCP *server* built into the Sketch
  Mac app.
