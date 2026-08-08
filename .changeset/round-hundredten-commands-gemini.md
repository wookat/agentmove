---
"agentmove-cli": minor
---

Commands layer for Gemini CLI: TOML custom commands migrate from `~/.gemini/commands/**/*.toml` (project `.gemini/commands/`; nested `:` namespaces preserved). This is a documented format conversion, not a byte-faithful copy: on export the TOML `prompt` becomes the markdown body and `description` becomes a one-line frontmatter; on import a description-only frontmatter is lifted back into the TOML field (other frontmatter is kept verbatim inside `prompt` with a warning). Invalid TOML or promptless files are warned and not migrated; `{{args}}`, `!{...}`, and `@{...}` placeholders are copied as-is with a warning.
