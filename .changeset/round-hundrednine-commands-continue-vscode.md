---
"agentmove-cli": minor
---

Commands layer for Continue and VS Code: Continue prompt files migrate from `~/.continue/prompts/` (project `.continue/prompts/`; nested markdown preserved, legacy v1 `.prompt` files warned and not migrated, `invokable: true` frontmatter requirement warned); VS Code Copilot prompt files migrate from the default profile's `User/prompts/*.prompt.md` folder (project `.github/prompts/`; flat, nested names flattened with a warning, Settings Sync noted).
