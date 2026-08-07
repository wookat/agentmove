# Test Plan — PR #72 Round 42: Continue adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied to temp homes.
Grounding: src/adapters/continue.ts — mcpServers LIST with per-entry `name` (L39-48); streamable-http→http parse (L47); render remote type streamable-http/sse + requestOptions.headers (L73-77); CLIENT_KEYS requestOptions/connectionTimeout warnings (L26,50-54); name-keyed merge preserving other keys (L88-117); rules merged with `<!-- rule: f.md -->` (L129-133); fresh config gets name/version/schema (L166-170); no skills/memory/disabled — warnings (L79-81,155,195-200). project.ts:790-855 — export .continue/mcpServers/*.yaml blocks + rules; import writes .continue/mcpServers/agentmove.yaml (schema v1 block) + .continue/rules/agentmove.md.
Fixture continue-home: config.yaml sqlite stdio (DB_TOKEN, connectionTimeout:5000) + sentry streamable-http + legacy sse; rules 01-general + 02-style; project block .continue/mcpServers/project-block.yaml.

## T1: doctor
- `--home <continue-home copy> doctor` → `✓ Continue (continue) — 3 MCP server(s), 0 skill(s), 0 memory entr(ies), instructions: yes` with warnings `mcp:sqlite: continue connectionTimeout setting is client-specific; not migrated` and `instructions: continue global rules files merged into one document` (also skills-not-exported note).

## T2: convert continue codex dry-run + bundle
- Exit 0; warnings incl. `mcp:sqlite.env.DB_TOKEN` redaction; nothing written (no .codex in home).
- Export bundle mcp-servers.json: `sentry` transport `"http"` (streamable-http mapped), `legacy` transport `"sse"`, sqlite env `${DB_TOKEN}`; instructions.md has `<!-- rule: 01-general.md -->` + `<!-- rule: 02-style.md -->`.

## T3: openclaw→continue --apply (openclaw-home copy + pre-seeded .continue fixture)
- Exit 0; config.yaml: name/version/schema preserved; existing sqlite (connectionTimeout intact + real DB_TOKEN), sentry, legacy entries kept; imported `docs` appended (stdio, no type) + `remote` with `type: streamable-http`, url, `requestOptions.headers.Authorization: ${Authorization}`.
- `.continue/rules/agentmove.md` = instructions + persona section; warnings: persona approximated, `memory: continue has no durable memory store; skipped`, `skills: continue has no SKILL.md mechanism; skills skipped`, YAML-comments note.

## T4: fresh-home import metadata
- Empty temp home, `convert openclaw continue --apply` → created config.yaml starts with `name: Local Config`, `version: 1.0.0`, `schema: v1`.

## T5: project-level convert claude-code continue --project <claude-project copy> --apply
- Writes `<proj>/.continue/mcpServers/agentmove.yaml`: valid YAML block with name "agentmove imported servers", version 0.0.1, schema v1, mcpServers list (search stdio + api type streamable-http with requestOptions.headers redacted); plus `<proj>/.continue/rules/agentmove.md`; skills-skipped warning.

## T6 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → 21 files / 118 tests passed.
- `export continu -o /tmp/x42` → exit 2, list includes `continue`, `did you mean "continue"?`.
