---
"agentmove-cli": minor
---

Commands layer for OpenCode and Qwen Code: migrate markdown slash commands to/from OpenCode (`~/.config/opencode/commands/`; project `.opencode/commands/`) and Qwen Code (`~/.qwen/commands/`; project `.qwen/commands/`), with nested subdirectory names preserved byte-faithfully. Qwen's deprecated TOML command files are warned per file on export (not migrated); client-specific frontmatter and argument placeholders are warned as usual.
