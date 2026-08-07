# GAP-ROUND-87: archive import (.zip / .tgz / .tar.gz)

## Signal

- Agent Plugins 1.0.0 (agent-plugins.org, 2026-08-06) deliberately leaves
  distribution to each client; the most common plugin distribution artifacts
  in practice are zip/tarball archives — GitHub release assets and
  "Download ZIP" (`/archive/refs/heads/<branch>.zip`) links.
- agentmove already imports from git URLs, tree URLs, blob/raw `.json` URLs,
  and local directories — archives were the remaining common transport with
  no path in (previously exit 3 "not an agentmove bundle").

## Decision

- `isArchiveInput()` matches `.zip`, `.tgz`, `.tar.gz` (query strings
  allowed). Applies to both http(s) URLs (downloaded to a temp file) and
  local files.
- `extractArchive()` extracts into a temp dir using system tools: `tar -xzf`
  for tarballs; for zip, `unzip` first then `tar -xf` fallback (bsdtar on
  Windows 10+ and macOS extracts zip natively, GNU/Linux runners ship
  `unzip`). No new npm dependencies.
- A single top-level directory (GitHub archive layout, `__MACOSX` ignored) is
  unwrapped; the result goes through the unchanged detection chain.
- Extraction failure → `CliError` exit 3 with the tool's first error line.

## Deferred

- `.tar.bz2` / `.7z` — no observed demand.
- Verifying archive checksums/signatures — distribution-level concern,
  out of scope for a converter.
