# agentmove-cli

## 0.8.1

### Patch Changes

- 5febb57: CLI UX polish benchmarked against gh/pnpm: mistyped commands and options now
  exit with the documented usage code (2) instead of 1; unknown clients suggest
  the nearest match ("did you mean \"gemini\"?"); `--help` gains an Examples
  section and a docs link.

## 0.8.0

### Minor Changes

- 87cefd6: Encrypted bundle transport: new `pack <bundle> [-o file]` and
  `unpack <file> [-o dir]` commands turn a bundle into a single portable
  `.agentpack` file encrypted with AES-256-GCM (key derived from the
  `AGENTMOVE_PASSPHRASE` environment variable via scrypt), so an agent can be
  carried across machines through untrusted channels. `import -i` accepts an
  `.agentpack` file directly. Missing passphrase is a usage error (exit 2);
  wrong passphrase or a tampered file fails authentication (exit 3).

## 0.7.0

### Minor Changes

- 4988eb8: New client: OpenHands (`openhands`). Migrates MCP servers via the `[mcp]`
  section of `~/.openhands/config.toml` (transport-specific `stdio_servers`,
  `shttp_servers`, and `sse_servers` lists; string-or-object remote entries;
  Bearer Authorization headers mapped to `api_key`, other headers dropped with a
  warning) and user microagents (`~/.openhands/microagents/*.md`) as the
  instructions layer. `--project` migrates `.openhands/microagents/` and
  `.openhands/skills/` (SKILL.md directories). Per-server `timeout` and
  conversation state are not portable — warned.

## 0.6.0

### Minor Changes

- 82fb721: New client: Zed (`zed`). Migrates MCP servers via the `context_servers` key of
  `~/.config/zed/settings.json` (JSONC parsed; unrelated settings preserved on
  merge; stdio servers always emitted with `args`, which Zed's schema requires)
  and personal instructions via `~/.config/zed/AGENTS.md`. `--project` migrates
  `.zed/settings.json` and `.rules`. Zed Rules Library / Skills are app-managed
  and not migrated; JSONC comments are not preserved on rewrite — both warned.

## 0.5.0

### Minor Changes

- 6ed683b: New client: Cline (`cline`). Migrates MCP servers via
  `~/.cline/data/settings/cline_mcp_settings.json` (remote transports normalized
  between Cline's `type: streamableHttp`/`sse` and the portable model, `disabled`
  flag mapped to the portable enabled state) and global rules via
  `~/Documents/Cline/Rules/*.md` (instructions layer). `--project` migrates
  `.clinerules/*.md`. The VS Code extension's own MCP settings copy in VS Code
  globalStorage is not touched; skills have no Cline equivalent — skipped with
  warnings.

### Patch Changes

- b2d3710: A memory/instructions-only import (e.g. `--only memory` or `--mif`) no longer
  rewrites the target client's MCP/config file when the import brings no MCP
  servers, no `--replace-mcp`, and no model change — the file is now left
  completely untouched instead of being re-serialized.

## 0.4.0

### Minor Changes

- 18111c7: New client: Windsurf (`windsurf`). Migrates MCP servers via
  `~/.codeium/windsurf/mcp_config.json` (remote servers normalized between
  `serverUrl` and the portable `url`) and global rules via
  `~/.codeium/windsurf/memories/global_rules.md` (instructions layer).
  `--project` migrates `.windsurf/rules/*.md`. Cascade memories are app-managed
  and cannot be migrated; skills have no Windsurf equivalent — both are skipped
  with warnings.
- d0f7f55: Memory interchange via MIF v2: `export --mif <file>` writes the memory layer
  as a vendor-neutral MIF document, and `import <client> --mif <file>` imports
  memories from a MIF document instead of a bundle. Non-portable MIF fields
  (embeddings, knowledge-graph data) are dropped with warnings; non-MIF input
  is a data error (exit 3).

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
