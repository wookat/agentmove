# Test Plan — PR #64 Round 38: Claude Desktop adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js`. Fixtures copied to temp dirs. Evidence: outputs + exit codes + file contents.
Grounding: adapters/claude-desktop.ts — CANDIDATE_RELS checked in order (Library/Application Support/Claude → AppData/Roaming/Claude → .config/Claude); import writes to found location else platform default (Linux = .config/Claude); export warns "only MCP servers migrate"; planImport warns per unsupported layer.

## T1: doctor detects claude-desktop
- `--home <claude-desktop-home copy> doctor` → `✓ Claude Desktop (claude-desktop) — 2 MCP server(s), 0 skill(s), 0 memory entr(ies), instructions: no`.

## T2: convert claude-desktop codex (dry-run)
- Exit 0; warnings include `mcp:filesystem.env.API_TOKEN: likely secret replaced with a ${VAR} placeholder` and `claude-desktop stores instructions/memory/projects inside the app; only MCP servers migrate`; nothing written.

## T3: convert openclaw claude-desktop --apply (openclaw-home copy)
- Pre-seed `<tmp>/.config/Claude/claude_desktop_config.json` with fixture content (filesystem + search).
- Pass: exit 0; file written to `.config/Claude/claude_desktop_config.json` (Linux default/existing location); merge keeps `filesystem` and `search`, adds `docs` (stdio) + `remote` (url, redacted Authorization, with proxy-setup warning for remote); skipped warnings present for instructions, persona, memory, and skills layers.

## T4: macOS location recognition
- Fresh temp home with ONLY `Library/Application Support/Claude/claude_desktop_config.json` (fixture content). `export claude-desktop -o <bundle>` must succeed and mcp-servers.json must contain filesystem+search (proves candidate-path scanning, not just .config).

## T5: unit tests
- `pnpm --filter agentmove-cli test` → 102/102 passed.

## T6 (Regression): client list + typo
- `export claude-desktp -o /tmp/x` → exit 2, list includes `claude-desktop`, `did you mean "claude-desktop"?`.
