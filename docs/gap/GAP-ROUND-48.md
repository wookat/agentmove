# GAP-ROUND-48 — Amazon Q Developer CLI adapter (24th client)

## Trigger / evidence

- Continuous-iteration mode; next high-value client after Droid (round 47).
- Candidates researched this round: Trae (ByteDance) and Amazon Q Developer
  CLI. Trae's user-level MCP config is app-managed inside the IDE profile and
  its project `.trae/mcp.json` is documented as experimental — deferred.
- Amazon Q Developer CLI (`q chat`) is AWS's official terminal agent with a
  stable, documented MCP file format — selected.

## Official format (verified against AWS docs + aws/amazon-q-developer-cli source)

- User MCP: `~/.aws/amazonq/mcp.json`, root key `mcpServers`
  (crates/chat-cli/src/util/paths.rs: `.aws/amazonq/mcp.json` global,
  `.amazonq/mcp.json` workspace).
- Entry fields (crates/chat-cli/src/cli/chat/tools/custom_tool.rs
  `CustomToolConfig`): `type` (`stdio` default / `http` — no `sse` variant),
  `command`/`args`/`env` for stdio, `url`/`headers` for http, plus
  client-specific `timeout` (ms), `oauth`, `oauthScopes`, and a native
  `disabled` flag.
- The CLI probes streamable-HTTP first and falls back to SSE at handshake
  time (mcp_client/oauth_util.rs), so SSE-only servers still work when
  written as `type: http`.
- Agents are JSON files in `~/.aws/amazonq/cli-agents/` (global) and
  `.amazonq/cli-agents/` (workspace); the built-in default agent sets
  `useLegacyMcpJson: true` and includes `file://AmazonQ.md` and
  `file://.amazonq/rules/**/*.md` as default resources.
- OAuth tokens are handled by the CLI's own flow — never exported.

## What shipped

- `amazonq` adapter (user scope): read/write `~/.aws/amazonq/mcp.json` with
  merge-by-name / `--replace-mcp`, native `disabled` ↔ portable
  `enabled: false` round-trip, `timeout`/`oauth`/`oauthScopes` warned as
  client-specific and preserved on merge, SSE imports downgraded to `http`
  with a warning. Instructions/persona/memory/skills have no user-level Q CLI
  slot — skipped with honest warnings.
- Project scope: `.amazonq/mcp.json` + `AmazonQ.md` (default-agent resource).
- 24×24 conversion matrix; fixture `amazonq-home`; unit tests for
  export/import/replace/project/missing-home.
- Docs: README table + counts, website hero/introduction/clients/limitations,
  man page, ROADMAP; docs-sync guard enforced the label everywhere.
- Changeset: minor (0.22.0 candidate).

## Known gaps (documented, not silently dropped)

- Agent JSON files (`cli-agents/*.json`) — prompts/tools/hooks are Q-specific;
  not modeled.
- `/knowledge` store is app-managed — skipped (use `--mif`).
- `.amazonq/rules/**/*.md` project rules are readable by the default agent but
  AgentMove writes project instructions to `AmazonQ.md` only (single canonical
  slot); rules-dir support can follow if requested.
- No user-level instructions file exists in Q CLI — imports warn and suggest
  `--project`.

## Verification

- `pnpm build`, lint, typecheck green.
- Full suite: 26 test files / 137 tests green; branch coverage 66.99%
  (gate: 65%).
- Website build green.
