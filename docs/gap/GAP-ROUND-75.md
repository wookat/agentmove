# GAP-ROUND-75: Warp Agent CLI — 46th client

## Trigger

Warp launched the **Warp Agent CLI** on 2026-08-04 (warp.dev blog
"Introducing the Warp Agent CLI"), a standalone terminal coding agent usable
in any terminal (Ghostty, iTerm2, VS Code, Windows Terminal). It keeps its
own configuration, separate from the Warp app the existing `warp` adapter
covers — a distinct migration target/source.

## Official evidence (docs.warp.dev)

- Configuration: https://docs.warp.dev/cli/configuration/
  - Settings: `settings.toml` — macOS `~/.warp_cli/settings.toml`, Linux
    `~/.config/warp-terminal/cli/settings.toml` (XDG), Windows
    `%LOCALAPPDATA%\warp\Warp\config\cli\settings.toml`. Themes/statusline —
    client-specific, not migrated.
  - MCP: "The CLI keeps its own MCP server configuration, separate from the
    Warp app's" — a JSON config file using the same `mcpServers` format as
    the Warp app's file-based servers (macOS: `~/.warp_cli/.mcp.json`).
  - Rules: project rules from root `AGENTS.md` (or `WARP.md`); global rules
    from `~/.agents/AGENTS.md` ("applies across all projects").
  - Skills: "The CLI discovers the same skills as the Warp app" — project
    `.agents/skills/`, personal `~/.agents/skills/`.
- File locations: https://docs.warp.dev/terminal/settings/file-locations/
  confirms the Warp app's own MCP config stays at `~/.warp/.mcp.json`
  (unchanged for the existing `warp` adapter).

## Mapping decisions

- New adapter `warp-cli` (label "Warp Agent CLI"), detect on `~/.warp_cli/`.
- MCP: `~/.warp_cli/.mcp.json`, reusing the `warp` adapter's parse/render
  (same entry shape: stdio `command`/`args`/`env` + `working_directory` ↔
  `cwd`; remote plain `url`, transport auto-negotiated; no disabled flag and
  sse degradation warned, merge-by-name, wrapper key preserved).
- Instructions: shared `~/.agents/AGENTS.md` global rules read/write, with a
  warning on import that the location is shared across agents; persona
  appended (approximated).
- Skills: shared `~/.agents/skills/` (same root Zed uses).
- Memory: none documented → skip warning.
- Project scope: root `AGENTS.md` (falls back to `WARP.md` on read) +
  `.agents/skills/`; MCP is not written at project scope — project
  `.warp/.mcp.json` files belong to the `warp` client, warned honestly.

## Deferred candidates

- Documented platform-divergent CLI paths (Linux
  `~/.config/warp-terminal/cli/`, Windows `%LOCALAPPDATA%`) — the adapter
  uses the documented primary `~/.warp_cli/` root; revisit if user reports
  show Linux installs only create the XDG path.
