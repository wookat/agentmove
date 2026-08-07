# GAP-ROUND-74: redact the raw config snapshot in bundles

## Finding

Reported by the v0.45.0 clean-environment regression (testing agent): exported
bundles redact likely secrets in the portable `mcp-servers.json`, but the
bundle's `config.json` stores a `raw` reference snapshot of the full source
config (every adapter sets `bundle.config.raw`), and that snapshot kept
unredacted literal values (e.g. `env.FS_API_KEY`, `headers.Authorization`).
A bundle shared or packed without `--include-secrets` could therefore still
leak secrets through the reference snapshot.

## Fix

`stripSecrets()` (`src/bundle.ts`) now also walks `bundle.config.raw`
recursively: any object entry whose key matches the existing
`SECRET_KEY_RE` (`key|token|secret|password|credential|authorization|cookie`)
and whose value is a non-placeholder string is replaced with `${KEY}` and
reported as `config.<path>.<key>` in the redaction warnings. Arrays and nested
objects are traversed; non-string values and existing `${VAR}` placeholders are
left untouched. `--include-secrets` bypasses redaction entirely, as before.

The snapshot is reference-only — no adapter reads `bundle.config.raw` during
import — so redacting it cannot affect import/convert output.

## Scope

- All 45 clients (every adapter populates `config.raw`).
- Export, convert, and pack paths (all funnel through `stripSecrets`).
