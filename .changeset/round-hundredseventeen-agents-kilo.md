---
"agentmove-cli": minor
---

Custom agents layer for Kilo Code: recursive markdown agents (custom modes) from `~/.config/kilo/{agent,agents}/` plus the legacy `~/.kilocode/` and `~/.kilo/` roots (XDG root wins on name conflicts; nested namespaced names preserved); imports write only `~/.config/kilo/agents/`. Project scope reads `.kilo/{agent,agents}/` + legacy `.kilocode/` and writes `.kilo/agents/`.
