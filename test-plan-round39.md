# Test Plan — PR #66 Round 39: VS Code adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js`. Fixtures copied to temp dirs. Evidence: outputs + exit codes + file contents.
Grounding: adapters/vscode.ts — CANDIDATE_RELS (.config/Code/User → Library/Application Support/Code/User → AppData/Roaming/Code/User), `servers` root key, renderCommonMcpEntry(..., transport!=="stdio") → stdio entries NO type, remote entries WITH type; export warns "only user MCP servers migrate"; planImport skips instructions/persona/memory/skills with warnings. project.ts:619-649 — project scope: `.vscode/mcp.json` + `.github/copilot-instructions.md`.

## T1: doctor detects vscode
- `--home <vscode-home copy> doctor` → `✓ VS Code (vscode) — 2 MCP server(s), 0 skill(s), 0 memory entr(ies), instructions: no`.

## T2: convert vscode codex (dry-run)
- Exit 0; warnings redact `playwright.env.API_TOKEN` and `github.headers.Authorization`; warning contains "only user MCP servers migrate"; nothing written.

## T3: convert openclaw vscode --apply (openclaw-home copy, pre-seed fixture mcp.json)
- Pass: exit 0; `.config/Code/User/mcp.json` keeps `playwright` + `github`, adds `docs` (stdio, NO `type` field) and `remote` (WITH `"type": "http"`, url, redacted Authorization); skipped warnings for instructions, persona, memory, skills.

## T4: macOS profile location recognition
- Fresh temp home with ONLY `Library/Application Support/Code/User/mcp.json` (fixture content); `export vscode -o <bundle>` succeeds and bundle lists playwright + github.

## T5: project-level convert claude-code vscode --project --apply
- claude-project copy + empty temp home. Pass: exit 0; `<proj>/.vscode/mcp.json` written (`servers` key with search/api); `<proj>/.github/copilot-instructions.md` written with project instructions; skills skipped warning.

## T6: unit tests
- `pnpm --filter agentmove-cli test` → 106/106 passed.

## T7 (Regression): client list + typo
- `export vscod -o /tmp/x` → exit 2, list includes `vscode`, `did you mean "vscode"?`.
