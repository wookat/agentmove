# Test Plan — PR #96 Round 55: Auggie CLI (Augment Code) adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixture copies in temp homes/projects.
Grounding: src/adapters/auggie.ts — user MCP under `mcpServers` of `~/.augment/settings.json`, other keys preserved on rewrite (L33,81-86); no disabled flag → `auggie has no disabled flag; imported as enabled` (L64-66); cwd dropped warned (L67); imports render explicit type (L68); rules dir merged on export with `<!-- rule: f.md -->` markers + multi-file merge warning `instructions: auggie user rules files merged into one document` (L91-107,126); import writes `.augment/rules/agentmove.md` with persona appended approximated (L145-157); memory warning `memory: auggie memories are app-managed; skipped (consider --mif)` (L158-160); skills `~/.augment/skills` (L127,161). project.ts:1271-1308 — auggieProject: `.augment/settings.json` merge (unrelated keys preserved), `.augment/rules/agentmove.md`, `.augment/skills`; persona/memory skipped at project scope.
Fixture auggie-home: settings.json `theme:"ansi"`, `enableChatInputCompletions:true`, filesystem stdio (no type, FS_API_KEY) + api-server http (Authorization); rules/style.md; skill deploy-helper.

## T1: doctor
- `--home <auggie-home copy> doctor` → `✓ Auggie CLI (auggie) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export auggie
- Exit 0; redaction warnings for FS_API_KEY + Authorization; bundle mcp-servers.json has `${FS_API_KEY}`/`${Authorization}`; instructions.md contains `<!-- rule: style.md -->` + style.md content (single file → NO merge warning); skills/deploy-helper in bundle; home copy diff-identical (no writes).

## T3: convert openclaw auggie --apply (openclaw-home copy + auggie fixture .augment in same home)
- Exit 0; merged settings.json keeps `theme:"ansi"` + `enableChatInputCompletions:true`; existing `filesystem` (no type, real key) + `api-server` untouched; imported `docs` explicit `"type":"stdio"` + `remote` explicit `"type":"http"` (redacted).
- `.augment/rules/agentmove.md` = openclaw instructions + `## Imported by agentmove: persona (SOUL.md)`; persona-approximated warning; style.md untouched; skill `.augment/skills/todo/SKILL.md` (deploy-helper kept); memory skip warning; backup created (settings.json rewritten).

## T4: crafted bundle (cwd + enabled:false)
- Bundle with `cwd-server` (stdio, cwd:/tmp/w) + `off-server` (http, enabled:false) imported into fresh auggie home copy.
- Pass: warnings `mcp:cwd-server: auggie does not support cwd; dropped` + `mcp:off-server: auggie has no disabled flag; imported as enabled`; entries written without cwd and as plain enabled.

## T5: multi rules-file export
- Home with `.augment/rules/a.md` + `b.md` (distinct content); export → warning `instructions: auggie user rules files merged into one document`; instructions.md contains both `<!-- rule: a.md -->` and `<!-- rule: b.md -->` sections in sorted order.

## T6: project scope (two-dir export→import)
- `export claude-code --project <claude-project copy>` → bundle; target seeded with `.augment/settings.json` `{"permissions":{"allow":["read"]},"mcpServers":{"existing":{"command":"node"}}}`; `import auggie --project <target> --apply`.
- Pass: merged `.augment/settings.json` keeps `permissions` key and `existing` untouched, adds `search` (type stdio) + `api` (type http, `${Authorization}`); `.augment/rules/agentmove.md` = project instructions; `.augment/skills/review/SKILL.md`; backup of seeded settings.json.
- --replace-mcp (fresh seeded copy): mcpServers = only imported; `mcp:existing: removed by --replace-mcp` warning; `permissions` still preserved.

## T7 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect 33 files / 167 tests; record actual).
- `export auggi -o /tmp/x55` → exit 2, list includes `auggie`, `did you mean "auggie"?`.
