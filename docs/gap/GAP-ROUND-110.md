# GAP-ROUND-110: commands layer for Gemini CLI (TOML custom commands)

## Evidence

- Official docs: https://geminicli.com/docs/cli/custom-commands/ and
  https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md
- User commands (global): `~/.gemini/commands/**/*.toml`; project commands:
  `<project>/.gemini/commands/**/*.toml` (project overrides user on name clash).
- Naming: path relative to the commands dir, subdirectories become namespaces
  (`git/commit.toml` → `/git:commit`) — same nested-name model as claude-code.
- TOML v1 format: required `prompt` (string), optional `description` (string).
  No other fields are documented.
- Placeholders inside `prompt`: `{{args}}` (raw or shell-escaped inside
  `!{...}`), `!{shell command}` output injection, `@{path}` file/dir content
  injection. All are gemini-specific runtime semantics.

## Decision (lossy-conversion policy, previously deferred in GAP-ROUND-103)

Gemini commands are a *format conversion*, not a byte-faithful copy:

- **Export (gemini → bundle):** each `*.toml` under the commands root
  (recursive, nested names preserved) is parsed; `prompt` becomes the markdown
  command body, `description` (when present) becomes a one-line YAML
  frontmatter block. Files with invalid TOML or without a string `prompt` get
  a per-file warning and are not migrated. Undocumented TOML fields get a
  per-file warning and are dropped (nothing silently lost). A bundle-level
  warning notes the conversion and that `{{args}}` / `!{...}` / `@{...}`
  placeholders are gemini-specific and copied as-is.
- **Import (bundle → gemini):** each command is written to
  `~/.gemini/commands/<name>.toml` (nested names preserved). A leading YAML
  frontmatter block that contains *only* `description:` is lifted into the
  TOML `description` field; any other frontmatter is kept verbatim inside
  `prompt` with a warning (gemini TOML has no equivalent fields). The rest of
  the markdown body becomes `prompt`. A gemini→gemini round trip therefore
  preserves `prompt` and `description` exactly.

## Deferred

- **Xcode bundled Gemini** shares the gemini-style adapter but its command
  discovery under the Xcode-managed config root is unverified; commands stay
  unsupported there until confirmed.
- **Antigravity / agy** command support is a separate surface; not covered.
- MCP-prompt-based commands exposed by MCP servers are runtime features of the
  server, not files; never migrated.
