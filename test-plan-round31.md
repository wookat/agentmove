# Test Plan — PR #52 Round 31: GitHub Copilot CLI adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js`. Evidence: command output + exit codes; inspect written files.

## T1: doctor detects copilot
- Copy fixtures/copilot-home to tmp; `--home <tmp> doctor`.
- Pass: output lists "GitHub Copilot CLI" as detected with 2 MCP servers and instructions: yes.

## T2: convert copilot codex (dry-run)
- Same copilot home; `--home <tmp> convert copilot codex` (no --apply).
- Pass: exit 0; warnings include copilot tool allowlist dropped (`[get_issue, list_pull_requests]`) and Authorization secret placeholder; plan lists `.codex/config.toml` and `.codex/AGENTS.md`; no files actually written under tmp/.codex.

## T3: convert openclaw copilot --apply (merge keeps existing servers)
- Copy fixtures/openclaw-home to tmp2 AND pre-seed tmp2/.copilot/mcp-config.json with an existing server `preexisting` (type local).
- Run `--home <tmp2> convert openclaw copilot --apply`.
- Pass: exit 0; tmp2/.copilot/mcp-config.json contains `preexisting` plus imported servers, stdio servers rendered with `"type": "local"`; tmp2/.copilot/instructions/agentmove-imported.instructions.md exists with instructions content.

## T4: project-level convert claude-code copilot --project --apply
- Copy fixtures/claude-project to tmp3; run `convert claude-code copilot --project <tmp3> --apply` (with --home empty-home copy to avoid touching real home).
- Pass: exit 0; tmp3/.mcp.json has mcpServers with stdio→`"type": "local"`; tmp3/.github/instructions/agentmove-imported.instructions.md exists.

## T5: unit tests
- `pnpm --filter agentmove-cli test` → all pass, 85 tests.

## T6 (Regression): did-you-mean
- `export gemni -o /tmp/x` → exit 2, message ends `did you mean "gemini"?`.
