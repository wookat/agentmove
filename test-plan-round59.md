# Test Plan — PR #104 Round 59: Vibe Code CLI adapter (shell-only)

CLI: `node packages/agentmove/dist/cli.js` after `pnpm build`. Fixture copies in mktemp homes/projects; never real data.
Grounding: src/adapters/vibe.ts — `~/.vibe/config.toml` `[[mcp_servers]]` array of tables keyed by per-entry `name` (L20-26,51-58); explicit `transport` on render: stdio command/args/env, http url/headers (L89-103); client-specific keys api_key_env/api_key_header/api_key_format/startup_timeout_sec/tool_timeout_sec/enabled_tools/disabled_tools → `vibe <key> setting is client-specific; not migrated` (L30-38,65-69); cwd `vibe does not document cwd; dropped` (L95); sse `vibe has no sse transport; emitted as http` (L97-99); enabled:false `vibe has no per-server disabled flag; server emitted as enabled` (L104-106); name-keyed array merge preserves existing entries, `--replace-mcp` removes with warning (L113-142); unrelated top-level key `active_model` preserved (config spread L152-160); persona → `~/.vibe/AGENTS.md` approximation (L201-207); memory skip (L211-213); skills `.vibe/skills` (L214). project.ts:1437-1474 — `.vibe/config.toml`, root AGENTS.md, `.vibe/skills`.
Fixture vibe-home: `active_model = "devstral-medium"`; `filesystem` stdio with `startup_timeout_sec = 30` + env FS_API_KEY; `api-server` http with Authorization header; AGENTS.md; skill deploy-helper.

## T1: clients + doctor
- `clients` lists `vibe  Vibe Code CLI  ~/.vibe (config.toml + AGENTS.md + skills/)`.
- `--home <vibe-home copy> doctor` → `✓ Vibe Code CLI (vibe) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes` and emits `mcp:filesystem: vibe startup_timeout_sec setting is client-specific; not migrated`.

## T2: export vibe (dual redaction, no writes)
- Exit 0; warnings redact FS_API_KEY + Authorization; bundle mcp-servers.json: filesystem stdio env `${FS_API_KEY}`, api-server http `${Authorization}`; instructions.md = fixture AGENTS.md; skills/deploy-helper; home copy `diff -r`-identical (no writes).

## T3: vibe→codex dry-run
- `convert vibe codex` no --apply → exit 0, `dry-run: would write ... file(s)` only; home `diff -r`-identical.

## T4: openclaw→vibe --apply merge
- Temp home = vibe fixture + openclaw fixture; `convert openclaw vibe --apply`.
- Pass: merged `.vibe/config.toml` keeps `active_model = "devstral-medium"`; existing `filesystem` entry intact incl. `startup_timeout_sec = 30` + real env token; `api-server` untouched; imported `docs` entry has `name`, `transport = "stdio"`, command/args, NO type/cwd keys; imported `remote` entry `transport = "http"` + url + redacted `${Authorization}` headers; `.vibe/AGENTS.md` = instructions + `## Imported by agentmove: persona (SOUL.md)` + warning; `.vibe/skills/todo/SKILL.md` (deploy-helper kept); `memory: vibe has no durable memory store; skipped (consider --mif)`; automatic backup.

## T5: crafted bundle — cwd / sse / enabled:false warnings
- Import bundle with `cwd-server` (stdio cwd), `legacy` (sse url), `off-server` (http enabled:false) into fresh vibe home.
- Pass warnings: `vibe does not document cwd; dropped` (no cwd key in written entry); `vibe has no sse transport; emitted as http` (entry `transport = "http"`); `vibe has no per-server disabled flag; server emitted as enabled` (no disabled key).

## T6: --replace-mcp
- Fresh vibe+openclaw home, `--apply --replace-mcp` → array contains only `docs`,`remote`; warnings `mcp:filesystem: removed by --replace-mcp` + `mcp:api-server: removed by --replace-mcp`; `active_model` preserved.

## T7: typo
- `export vibee -o /tmp/x59` → exit 2, list includes `vibe`, `did you mean "vibe"?`.

## T8: project scope (two-dir export→import; claude-code and vibe share root AGENTS.md)
- Target seeded with `.vibe/config.toml` (`active_model` + one `[[mcp_servers]]` "existing" entry) + root `AGENTS.md`.
- `export vibe --project <target>` parses the seeded array (1 MCP + instructions).
- `export claude-code --project <claude-project copy>` → `import vibe --project <target> --apply`: keeps `active_model` + `existing`, appends `search` (transport stdio) + `api` (transport http, `${Authorization}`); root AGENTS.md rewritten; `.vibe/skills/review/SKILL.md`; backup. `--replace-mcp` fresh copy → only imported + removal warning.

## T9 (Regression): full suite
- `pnpm --filter agentmove-cli test` → all green (record actual counts; expect ~37 files / ~188 tests).
