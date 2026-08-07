# Test Plan — v0.31.0 npm release regression (kimi focus, clean env via npx)

Run everything from a repo-independent temp dir (`mktemp -d`), using `npx -y agentmove-cli@0.31.0` (NOT the local build). Fixture copies from `/home/ubuntu/repos/agentmove/packages/agentmove/test/fixtures/{kimi-home,openclaw-home}` into temp HOMEs. Registry check done: `npm view agentmove-cli@0.31.0 version dist-tags` → 0.31.0, latest.

## T1: version / clients / doctor
- `npx -y agentmove-cli@0.31.0 --version` → `0.31.0`.
- `clients` → list contains `kimi  Kimi Code CLI  ~/.kimi-code (mcp.json + AGENTS.md + skills/)`.
- `--home <kimi-home copy> doctor` → `✓ Kimi Code CLI (kimi) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export kimi (dual redaction, no writes)
- `--home <copy> export kimi -o <tmp bundle>` → exit 0; warnings redact both `FS_API_KEY` and `Authorization`; bundle mcp-servers.json: filesystem stdio env `${FS_API_KEY}`; api-server transport http headers `${Authorization}`; home copy `diff -r`-identical to fixture (no writes).

## T3: kimi→codex dry-run
- `convert kimi codex` WITHOUT --apply → exit 0, prints `dry-run: would write ... file(s)`; home `diff -r`-identical afterwards (no writes).

## T4: convert openclaw kimi --apply (merge)
- Temp home = kimi fixture (with `filesystem.startupTimeoutMs:5000` added) + openclaw fixture; run with --apply.
- Pass: merged `.kimi-code/mcp.json` keeps `filesystem` verbatim incl. `startupTimeoutMs:5000` + `api-server` untouched; imported `docs` stdio has NO `type` field; `remote` plain url + `${Authorization}` headers (no transport field); AGENTS.md = instructions + `## Imported by agentmove: persona (SOUL.md)` with persona-approximated warning; `.kimi-code/skills/todo/SKILL.md` written (deploy-helper kept); `memory: kimi has no durable memory store; skipped (consider --mif)`; automatic backup under `.agentmove/backups/<ts>/`.
- Also expect export/parse warning path: `mcp:filesystem: kimi startupTimeoutMs is client-specific; not migrated` visible when parsing the seeded home (during convert or via export).

## T5: typo regression
- `npx -y agentmove-cli@0.31.0 export kimii -o /tmp/x` → exit 2, list includes `kimi`, `did you mean "kimi"?`.
