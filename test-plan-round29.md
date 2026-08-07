# Test Plan — PR #49 Round 29 CLI UX (shell-only, no recording)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (built from branch).
Evidence: capture stdout/stderr + `echo exit=$?` for each command.

## T1: Mistyped command exits 2 with suggestion
- Run `cli.js exprot`; expect exit code **2** (was 1) and stderr containing `unknown command 'exprot'` plus `(Did you mean export?)`.

## T2: Mistyped option exits 2 with suggestion
- Run `cli.js convert openclaw hermes --aply`; expect exit **2**, stderr with `unknown option '--aply'` and `(Did you mean --apply?)`.

## T3: --help / --version exit 0
- `cli.js --help` → exit **0**, output includes an `Examples:` section with `agentmove doctor` line and `Docs: https://agentmove.zalize.com`.
- `cli.js --version` → exit **0**, prints version string.

## T4: Unknown client near miss
- `cli.js --home <fixture-copy> export gemni -o /tmp/x` → exit **2**, message `unknown client "gemni" (expected one of: ...)` ending with `did you mean "gemini"?`.

## T5: Unknown client far off — no suggestion
- `cli.js --home <fixture-copy> export xyzzyplugh -o /tmp/x` → exit **2**, lists clients, message must NOT contain `did you mean`.

## T6 (Regression): happy path still exits 0
- Copy `packages/agentmove/test/fixtures/openclaw-home` to temp dir; run `cli.js --home <tmp> convert openclaw hermes --apply` → exit **0**, output indicates applied changes; hermes config files created under tmp home.
