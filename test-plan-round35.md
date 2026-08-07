# Test Plan — PR #59 Round 35: goose adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js`. Fixtures copied to temp dirs. Evidence: outputs + exit codes + file contents.
Grounding: adapters/goose.ts (fromGooseExtension: builtin skipped, streamable_http→http, uri→url, envs→env; toGooseExtension: stdio→cmd/args/envs, http→streamable_http+uri, enabled flag, timeout 300); project.ts:571-598 (project goose: .goosehints + .goose/memory export, MCP skipped with warning).

## T1: doctor detects goose
- `--home <goose-home copy> doctor` → `✓ goose (goose) — 2 MCP server(s), 1 skill(s), 2 memory entr(ies), instructions: yes` (builtin developer NOT counted as 3rd server).

## T2: convert goose claude-code (dry-run) + bundle proof
- Dry-run exit 0; warnings redact `filesystem.envs.API_TOKEN` and `remote-tools.headers.Authorization`; summary `2 memory entr(ies)`; nothing written.
- Export bundle: mcp-servers.json has `filesystem` transport stdio (command npx) and `remote-tools` transport **http** with url `https://example.com/mcp` and `"enabled": false` preserved; NO entry for `developer`. memory.json = 2 entries (dark mode / pnpm workspaces), no `# style` tag line in content.

## T3: convert openclaw goose --apply (openclaw-home copy)
- Pre-seed `<tmp>/.config/goose/config.yaml` with builtin developer + extension `preexisting` (stdio).
- Pass: exit 0; config.yaml still has `developer` (type builtin) and `preexisting`; adds `docs` (type stdio, cmd: npx, args list, timeout 300, enabled true) and `remote` (type streamable_http, uri, redacted Authorization headers); `.config/goose/.goosehints` contains instructions + persona approximation section; `.config/goose/memory/imported.txt` has 3 openclaw memories; skill at `.agents/skills/todo/SKILL.md`.

## T4: project-level convert claude-code goose --project --apply
- claude-project copy + empty temp home. Pass: exit 0; warning `mcp: goose has no project-scoped extension config; skipped (import at user scope instead)`; `<proj>/.goosehints` written with project instructions; `<proj>/.agents/skills/review/SKILL.md` written; NO project mcp/extension config file created.

## T5: unit tests
- `pnpm --filter agentmove-cli test` → 96/96 passed.

## T6 (Regression): client list + typo
- `export goos -o /tmp/x` → exit 2, list includes `goose`, `did you mean "goose"?`.
