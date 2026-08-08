---
"agentmove-cli": minor
---

Commands layer for Trae (ByteDance): global commands migrate from both edition roots — `~/.trae/commands/` (international) and `~/.trae-cn/commands/` (CN edition) — recursively with nested names preserved and the international root winning on name conflicts (warned). Imports write only `~/.trae/commands/`; project scope covers `.trae/commands/`. Commands nested deeper than Trae's documented 3-level limit are written with a warning; frontmatter and argument conventions from other clients are copied as-is with a warning.
