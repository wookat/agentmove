# Test Plan — PR #62 Round 37: Amp adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js`. Fixtures copied to temp dirs. Evidence: outputs + exit codes + file contents.
Grounding: adapters/amp.ts (settings.json flat `amp.mcpServers` key, renderAmpEntry uses renderCommonMcpEntry(..., false) → no `type` field; AGENTS.md gets persona+memory appended sections); project.ts:572-612 (project `.amp/settings.json` + `amp mcp approve` warning; persona/memory skipped at project scope).

## T1: doctor detects amp
- `--home <amp-home copy> doctor` → `✓ Amp (amp) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: convert amp claude-code (dry-run) + bundle proof
- Dry-run exit 0; warnings redact `playwright.env.API_TOKEN` and `linear.headers.Authorization`; nothing written.
- Export bundle: mcp-servers.json shows `playwright` transport stdio and `linear` transport **http** with url `https://mcp.linear.app/sse`.

## T3: convert openclaw amp --apply (openclaw-home copy)
- Pre-seed `<tmp>/.config/amp/settings.json` = fixture content (playwright + linear + `"amp.notifications.enabled": true`).
- Pass: exit 0; settings.json still has `amp.notifications.enabled: true`, `playwright`, `linear`, plus imported `docs` (command/args, NO `type` field) and `remote` (url + redacted Authorization, NO `type` field); `.config/amp/AGENTS.md` has instructions + `## Imported by agentmove: persona (SOUL.md)` + memory section listing 3 openclaw memories; skill at `.agents/skills/todo/SKILL.md`.

## T4: project-level convert claude-code amp --project --apply
- claude-project copy + empty temp home. Pass: exit 0; warning `mcp: amp workspace servers require approval in amp before first use (amp mcp approve)`; `<proj>/.amp/settings.json` with `amp.mcpServers` (search/api, no type field); `<proj>/AGENTS.md`; `<proj>/.agents/skills/review/SKILL.md`.

## T5: unit tests
- `pnpm --filter agentmove-cli test` → 99/99 passed.

## T6 (Regression): client list + typo
- `export ampp -o /tmp/x` → exit 2, list includes `amp`, `did you mean "amp"?`.
