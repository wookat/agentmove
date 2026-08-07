# Test Plan — PR #55 Round 33: OpenCode adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js`. Evidence: outputs + exit codes + written file contents. Fixtures copied to temp dirs.

## T1: doctor detects opencode
- `--home <opencode-home copy> doctor` → line `✓ OpenCode (opencode) — 2 MCP server(s), 1 skill(s), ... instructions: yes`.

## T2: convert opencode claude-code (dry-run)
- Expect exit 0; warnings include `mcp:jira.headers.Authorization: likely secret replaced with a ${VAR} placeholder` and a disabled-flag warning for jira (`enabled: false`); plan lists `~/.claude.json` (and other claude files); nothing written.

## T3: convert openclaw opencode --apply (openclaw-home copy)
- Pre-seed `<tmp>/.config/opencode/opencode.json` with server `preexisting` (`type: local`, command argv array).
- Pass: exit 0; opencode.json contains `preexisting` + imported: stdio `docs` as `"type": "local"` with `"command": ["npx", "-y", ...]` (argv array), remote as `"type": "remote"` with url; skill written to `.config/opencode/skills/todo/SKILL.md`.

## T4: project-level convert claude-code opencode --project --apply
- claude-project copy + empty temp home. Pass: exit 0; `<proj>/opencode.json` written (`mcp` map, local server command as argv array); `<proj>/AGENTS.md` written; skills under `<proj>/.opencode/skills/` if bundle had skills (claude-project fixture has 1 skill).

## T5: unit tests
- `pnpm --filter agentmove-cli test` → 89/89 passed.

## T6 (Regression): client list + typo
- `export opencod -o /tmp/x` → exit 2, list includes `opencode`, `did you mean "opencode"?`.
