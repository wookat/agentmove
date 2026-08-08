---
"agentmove-cli": minor
---

Commands layer for CodeBuddy and Droid (Factory): migrate markdown slash commands to/from CodeBuddy (`~/.codebuddy/commands/`; project `.codebuddy/commands/`; nested directories preserved as `/group:command` names) and Droid (`~/.factory/commands/`; project `.factory/commands/`; nested directories preserved). Droid shebang script commands are warned per file and not migrated; frontmatter and argument placeholders are copied as-is with client-specific warnings.
