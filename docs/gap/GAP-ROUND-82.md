# GAP-ROUND-82: URL import (`import -i <url>`)

## Research

- Kiro's Agent Plugin rollout (kiro.dev/changelog/ide) installs Powers
  "packaged in the open Agent Plugin format from a local folder **or GitHub
  URL**" — URL installation is becoming the distribution norm for Agent
  Plugins.
- Vercel's launch post lists ChatGPT/Codex, Cursor, GitHub Copilot, Kiro, and
  VS Code as launch clients; plugin sharing happens via git repos.
- GAP-ROUND-79 deferred URL input for standalone mcp.json ("curl | tee covers
  it"). With plugin repos and hosted team mcp.json files now the common sharing
  mechanism, first-class URL input removes a real step for every teammate.

## Decision

`import <client> -i <url>`:

- `.json` URL → fetched (global `fetch`, Node ≥ 20) to a temp file, then the
  existing standalone mcp.json path handles it.
- any other http(s) URL → `git clone --depth 1` to a temp dir
  (`GIT_TERMINAL_PROMPT=0`), then the existing detection chain handles it:
  Agent Plugin (`plugin.json`) or agentmove bundle.
- `http://` allowed but warned (insecure); useful for internal servers and
  testability.
- fetch/clone failures → `CliError` with exit 3 (data error), consistent with
  other unreadable inputs.

## Alternatives considered

- URL support on `export -o` / `--mcp-json`: no meaningful write target
  semantics over HTTP; rejected.
- Downloading `.agentpack` over URL: possible follow-up; binary fetch + the
  existing passphrase flow would compose, deferred until requested.
- A registry/marketplace: spec explicitly leaves distribution to clients;
  out of scope.
