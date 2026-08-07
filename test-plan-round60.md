# Test Plan — Round 60: Nanocoder adapter (PR #106, 36th client)

Built CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js`. All tests in `mktemp -d` temp dirs with fixture copies from `packages/agentmove/test/fixtures/{nanocoder-home,openclaw-home}`. Shell-only, no recording.

Nanocoder semantics (src/adapters/nanocoder.ts, src/project.ts:1477–1517):
- User MCP: `~/.config/nanocoder/.mcp.json` `mcpServers` map; explicit `transport` field; websocket skipped on export; client-specific keys timeout/alwaysAllow/description/tags warn; `enabled:false` round-trips.
- User import: instructions/persona/skills/memory all warn+skip (instructions warning points to --project).
- Project: `.mcp.json` + root `AGENTS.md`; persona appended to AGENTS.md; skills skipped with skill.yaml warning.

## T1 clients/doctor
- `clients` contains `nanocoder  Nanocoder  ~/.config/nanocoder/.mcp.json`.
- `--home <nanocoder-home copy> doctor` → `✓ Nanocoder (nanocoder) — 2 MCP server(s), 0 skill(s), 0 memory entr(ies), instructions: no` plus warnings `mcp:filesystem: nanocoder alwaysAllow setting is client-specific; not migrated` and `mcp:api-server: nanocoder timeout setting is client-specific; not migrated`.

## T2 export nanocoder (redaction, no writes)
- `export nanocoder -o <bundle>` exit 0; bundle mcp-servers.json: filesystem stdio env `FS_API_KEY: "${FS_API_KEY}"`; api-server transport http headers `Authorization: "${Authorization}"`; home copy `diff -r`-identical to fixture afterwards.

## T3 nanocoder→codex dry-run
- `convert nanocoder codex` without --apply → exit 0, prints `dry-run: would write 1 file(s)` (only codex config.toml since no instructions/skills); home `diff -r`-identical (no writes).

## T4 convert openclaw nanocoder --apply (merge)
- Temp home = nanocoder fixture + openclaw fixture; `convert openclaw nanocoder --apply`.
- Merged `.config/nanocoder/.mcp.json`: existing `filesystem` verbatim (alwaysAllow + real token intact), `api-server` verbatim (timeout 30000); imported `docs` = `{"transport":"stdio","command":"npx","args":[...]}` no url/cwd; imported `remote` = `{"transport":"http","url":"https://example.com/mcp","headers":{"Authorization":"${Authorization}"}}`.
- Warnings: `instructions: nanocoder reads AGENTS.md from the project root only; use --project`; `persona: nanocoder has no persona file; skipped (use --project for AGENTS.md)`; `memory: nanocoder has no durable memory store; skipped (consider --mif)`; `skills: nanocoder skills use their own skill.yaml bundle format, not the Agent Skills standard; skipped`.
- No AGENTS.md or skills written anywhere under home except `.config/nanocoder/.mcp.json` + backups; backup under `.agentmove/backups/<ts>/.config/nanocoder/.mcp.json`.

## T5 websocket skip + enabled:false round-trip
- Temp home with `.mcp.json` containing `ws` entry `{"transport":"websocket","url":"wss://..."}` and `off` entry `{"transport":"stdio","command":"node","enabled":false}`.
- `export nanocoder` warns `mcp:ws: nanocoder websocket transport has no portable equivalent; skipped`; bundle contains no `ws`, and `off` has `"enabled": false`.
- Import bundle with enabled:false into fresh home → written entry has `"enabled": false`.

## T6 project scope
- Source project dir: `.mcp.json` w/ `search` server + `AGENTS.md`; `export claude-code --project` from a claude-style project, or simpler: export nanocoder --project from source dir → bundle has server + instructions.
- Target project dir seeded with `.mcp.json` (`existing` server w/ `"timeout": 9000`) + `AGENTS.md`; import bundle (with persona) `--project --apply` → merge keeps `existing` verbatim, adds imported servers; `AGENTS.md` rewritten with instructions + `## Imported by agentmove: persona (SOUL.md)` and warning `persona: appended to AGENTS.md (approximated)`; backup created.
- `--replace-mcp` on fresh target copy → `existing` removed with `mcp:existing: removed by --replace-mcp`.

## T7 typo
- `export nanocder` → exit 2, client list includes `nanocoder`, `did you mean "nanocoder"?`.
