# Test Plan — PR #100 Round 57: Kimi Code CLI adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixture copies in temp homes/projects; never real data.
Grounding: src/adapters/kimi.ts — user MCP `~/.kimi-code/mcp.json` `mcpServers` (L34); fromKimiEntry: `transport:"sse"`→type sse (L54-60); toKimiEntry: renderCommonMcpEntry(...,false) → NO type field, cwd kept natively (not stripped), sse re-emits `transport:"sse"`, `enabled:false` written natively (L63-68); client-specific fields bearerTokenEnvVar/startupTimeoutMs/toolTimeoutMs/enabledTools/disabledTools warned on parse `kimi <field> is client-specific; not migrated` (L38-44,81-85) and preserved on merge (mergeMcpRecords keeps existing entries verbatim); instructions `~/.kimi-code/AGENTS.md` + persona appended approximated (L130,149-157); memory `kimi has no durable memory store; skipped (consider --mif)` (L159-161); skills `~/.kimi-code/skills` (L131,162). project.ts:1357-1394 — kimiProject: `.kimi-code/mcp.json`, root AGENTS.md, `.kimi-code/skills`.
Fixture kimi-home: filesystem stdio (FS_API_KEY) + api-server plain url (Authorization); AGENTS.md; skill deploy-helper.

## T1: doctor + clients
- `clients` output lists `kimi  Kimi Code CLI  ~/.kimi-code (mcp.json + AGENTS.md + skills/)`.
- `--home <kimi-home copy> doctor` → `✓ Kimi Code CLI (kimi) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export kimi (redaction)
- Exit 0; warnings redact FS_API_KEY + Authorization; bundle mcp-servers.json has `${FS_API_KEY}`/`${Authorization}`; api-server transport http; instructions.md = fixture AGENTS.md; skills/deploy-helper; home copy diff-identical (no writes).

## T3: kimi→codex dry-run no writes
- `convert kimi codex` WITHOUT --apply on a kimi-home+codex-less temp home → exit 0, plan printed, `diff -r` home copy identical to pre-state (no files written anywhere in home).

## T4: openclaw→kimi --apply merge (seeded kimi home with client-specific field)
- Seed kimi fixture copy where `filesystem` entry has `"startupTimeoutMs": 5000` added; copy openclaw-home into same home; run `convert openclaw kimi --apply`.
- Pass: merged `.kimi-code/mcp.json` keeps `filesystem` verbatim incl. `startupTimeoutMs:5000` and `api-server` (real tokens); imported `docs` stdio has NO `type` field; `remote` written as plain url+headers (redacted, no transport field); AGENTS.md = instructions + `## Imported by agentmove: persona (SOUL.md)` + persona warning; `.kimi-code/skills/todo/SKILL.md` (deploy-helper kept); memory skip warning; automatic backup.
- Supplement (crafted bundle import into fresh kimi home): `cwd-server` (stdio cwd:/tmp/w) → written WITH `"cwd": "/tmp/w"` (native support, no drop warning); `legacy` (sse url) → written with `"transport": "sse"`; `off-server` (http enabled:false) → written with `"enabled": false` (no disabled warning). Also doctor/export on seeded home emits `mcp:filesystem: kimi startupTimeoutMs is client-specific; not migrated`.

## T5: --replace-mcp
- Fresh kimi fixture copy + openclaw; `convert openclaw kimi --apply --replace-mcp` → mcpServers = only `docs,remote`; warnings `mcp:filesystem: removed by --replace-mcp` + `mcp:api-server: removed by --replace-mcp`.

## T6: typo
- `export kimii -o /tmp/x57` → exit 2, list includes `kimi`, `did you mean "kimi"?`.

## T7: project scope (two-dir export→import)
- `export claude-code --project <claude-project copy>` → bundle; target seeded with `.kimi-code/mcp.json` `{"mcpServers":{"existing":{"command":"node","startupTimeoutMs":9000}}}` + root `AGENTS.md` ("# Old"); `import kimi --project <target> --apply`.
- Pass: merged `.kimi-code/mcp.json` keeps `existing` verbatim (incl. startupTimeoutMs), adds `search` (stdio, no type) + `api` (plain url, `${Authorization}`); root AGENTS.md rewritten with project instructions; `.kimi-code/skills/review/SKILL.md`; backup. --replace-mcp fresh copy → only imported + removal warning.

## T8 (Regression): full suite
- `pnpm --filter agentmove-cli test` → all green (record actual counts; expect ~35 files / ~178 tests).
