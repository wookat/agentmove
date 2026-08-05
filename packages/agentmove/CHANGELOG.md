# agentmove-cli

## 0.3.0

### Minor Changes

- 7b0c883: Project-scoped migration: `export`/`import`/`convert` accept `--project <dir>`
  to migrate a repository's client files instead of user-scoped config —
  `.mcp.json`/`CLAUDE.md`/`.claude/skills` (claude-code), `AGENTS.md`/`.agents/skills`
  (codex), `.gemini/settings.json`/`GEMINI.md` (gemini), and
  `.cursor/mcp.json`/`.cursor/rules/*.mdc` (cursor). MCP merge semantics, secret
  redaction, dry-run, and backups (to `<dir>/.agentmove/backups`) work the same
  as user-scoped migration. OpenClaw/Hermes have no project scope (usage error).

## 0.2.2

### Patch Changes

- 86b86e6: `export` now removes bundle-owned files (manifest, config, mcp-servers,
  instructions, persona, memory/, skills/) from the output directory before
  writing, so re-exporting into the same directory (especially with `--only`)
  no longer leaves stale layers behind. Files agentmove does not own are left
  untouched.

## 0.2.1

### Patch Changes

- ce5a79e: Security: `Authorization` and `Cookie`-style MCP headers are now redacted to
  `${VAR}` placeholders on export by default (previously only names matching
  key/token/secret/password/credential were). Use `--include-secrets` to keep
  real values.

## 0.2.0

### Minor Changes

- 7cd2482: Partial migration: `export`, `import`, and `convert` accept `--only <layers>`
  (comma-separated subset of `mcp`, `skills`, `memory`, `instructions`,
  `persona`) to migrate just the layers you ask for. Unknown layer names fail
  with exit code 2. Shell completion and the man page cover the new flag.

## 0.1.2

### Patch Changes

- b3fcb92: Fix the shipped man page never being linked by npm: npm only links man files
  whose basename matches the package name, so `man/agentmove.1` is renamed to
  `man/agentmove-cli.1`. After a global install, `man agentmove-cli` now works.

## 0.1.1

### Patch Changes

- 8748781: Maturity wave: real-environment e2e tests for the built CLI, coverage gate in CI, governance files, and honest memory/persona limitation docs. No behavior changes to the CLI itself.
- 4276a2b: Production-benchmark round 8: global `--debug` flag (or `AGENTMOVE_DEBUG=1`)
  prints a full stack trace on unexpected errors; default output stays a single
  readable line with a hint to rerun with `--debug`.
- 0769894: Production-benchmark round 4: new `agentmove completion <bash|zsh>` command
  generating shell completion for commands, client ids, and flags (enable with
  `eval "$(agentmove completion bash)"`).
- 41b1778: Production-benchmark round 1: imports now merge MCP servers into the target's
  existing list instead of replacing it (opt out with `--replace-mcp`), config
  parse errors include the offending file path, and the CLI follows a documented
  exit-code contract (0 success, 1 unexpected, 2 usage, 3 bad input data).
- ea028fe: Production-benchmark round 7: ship a man page (`man agentmove` after a global
  install) covering all commands, options, exit codes, and files.
- 6c77a04: Production-benchmark round 6: fish shell completion (`agentmove completion
fish`), and `--version` now reads the real package version instead of a
  hardcoded string.
- 0769894: Production-benchmark round 3: new `agentmove clients [--json]` command listing
  supported clients and their default config locations, `export --json` for
  consistency with the other commands, and permission errors (EACCES/EPERM) now
  include remediation guidance.
- 07eb2ef: Production-benchmark round 2: `--json` machine-readable output on
  `import`/`convert`/`diff`/`doctor`, a per-layer `migrated:` summary after
  `--apply`, and Node 20 LTS support (engines lowered to >=20, CI runs a
  Node 20 + 22 matrix).
