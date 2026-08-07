# Test Plan — PR #57 Round 34: Qwen Code adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js`. Fixtures copied to temp dirs. Evidence: outputs + exit codes + file contents.

## T1: doctor detects qwen
- `--home <qwen-home copy> doctor` → `✓ Qwen Code (qwen) — 2 MCP server(s), 1 skill(s), 2 memory entr(ies), instructions: yes`.

## T2: convert qwen claude-code (dry-run)
- Exit 0. `remoteServer` (httpUrl) parsed as remote, NOT dropped (must appear in migrated count "2 MCP server(s)" and no "dropped"/"unsupported" warning for remoteServer's transport).
- Warnings include redaction of `remoteServer.headers.Authorization` and `mainServer.env.API_TOKEN`.
- Migration summary shows `2 memory entr(ies)`. Nothing written.

## T3: convert openclaw qwen --apply (openclaw-home copy)
- Pre-seed `<tmp>/.qwen/settings.json` with server `preexisting`.
- Pass: exit 0; settings.json contains `preexisting` + `docs` (stdio: command/args) + `remote` (remote, redacted Authorization); `.qwen/QWEN.md` contains instructions, `## Imported by agentmove: persona`-style approximation section, and `## Qwen Added Memories` with the 3 openclaw memory entries; skill at `.qwen/skills/todo/SKILL.md`.

## T4: project-level convert claude-code qwen --project --apply
- claude-project copy + empty temp home. Pass: exit 0; `<proj>/.qwen/settings.json` (mcpServers with search/api), `<proj>/QWEN.md` (project instructions), `<proj>/.qwen/skills/review/SKILL.md`.

## T5: unit tests
- `pnpm --filter agentmove-cli test` → 92/92 passed.

## T6 (Regression): client list + typo
- `export qwenn -o /tmp/x` → exit 2, list includes `qwen`, `did you mean "qwen"?`.
