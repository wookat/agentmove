# agentmove-cli

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
