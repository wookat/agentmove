# Test Plan — PR #90 Round 52: Trae (ByteDance) adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied into temp homes/projects.
Grounding: src/adapters/trae.ts — user scope skills-only `~/.trae/skills` (L33,110,137); export warns app-managed MCP (Settings > MCP, use --project) + app-managed global rules (L111-115); import warns mcp/instructions --project pointers, persona skipped, memories app-managed (L123-136); render no type/disabled, enabled:false warned, sse warned, cwd dropped warned (L58-69). project.ts:1111-1165 — traeProject: .trae/mcp.json merge via planTraeMcp (L1137-1145), `Enable Project MCP` toggle warning (L1146-1148), rules export concatenated with `<!-- .trae/rules/f.md -->` markers (L1118-1130), import writes .trae/rules/agentmove-imported.md (L1156) + .trae/skills (L1162).
Fixture trae-home: only .trae/skills/deploy-helper/SKILL.md.

## T1: doctor
- `--home <trae-home copy> doctor` → `✓ Trae (trae) — 0 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: no, persona: no` with app-managed MCP + rules warnings.

## T2: export trae
- Exit 0; bundle contains skills/deploy-helper/SKILL.md, mcp-servers.json empty `[]`; warnings `mcp: trae user-level MCP servers are app-managed (Settings > MCP) ... use --project` and `instructions: trae global rules are app-managed; use --project for .trae/rules`; home copy diff-identical (no writes).

## T3: convert openclaw trae --apply (user scope; openclaw-home copy + trae fixture .trae in same home)
- Exit 0; ONLY `.trae/skills/todo/SKILL.md` written (existing deploy-helper untouched); no .trae/mcp.json, no rules files at user scope.
- Warnings: mcp --project pointer, instructions --project pointer, `persona: trae has no persona file; skipped`, `memory: trae memories are app-managed; skipped (consider --mif)`. Backup only if overwritten files existed (planSkills writes new file → likely no backup needed; record actual behavior).

## T4: project scope (claude-code → trae --project --apply)
- claude-project fixture copy + pre-seed `.trae/mcp.json` `{"mcpServers":{"existing":{"command":"node"}}}` + `.trae/rules/style.md`.
- Merge run: merged `.trae/mcp.json` keeps `existing`, adds `search` (stdio, NO type key) + `api` (plain url, redacted Authorization, NO type key); `.trae/rules/agentmove-imported.md` written with project instructions (style.md untouched); `.trae/skills/review/SKILL.md` written; warning `mcp: trae loads .trae/mcp.json only after the Enable Project MCP toggle is on (Settings > MCP)`.
- --replace-mcp run (fresh seeded copy): mcpServers = only imported servers; `mcp:existing: removed by --replace-mcp` warning.

## T5 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect 30 files / 152 tests; record actual).
- `export trea -o /tmp/x52` → exit 2, list includes `trae`, `did you mean "trae"?`.
