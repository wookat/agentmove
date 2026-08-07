---
"agentmove-cli": minor
---

New clients: Xcode 26's bundled agents (40th–42nd clients, macOS): `xcode-claude`, `xcode-codex`, and `xcode-gemini` migrate the per-agent config roots under `~/Library/Developer/Xcode/CodingAssistant` (`ClaudeAgentConfig/`, `codex/`, `gemini/`), which are isolated from the standalone CLIs' `~/.claude`/`~/.codex`/`~/.gemini`. File formats, merge semantics, and lossy edges match the corresponding standalone client (Claude Code / Codex CLI / Gemini CLI); `xcode-codex` has no documented skills directory, so imported skills are skipped with a warning. Migrate between a standalone CLI and its Xcode twin with e.g. `agentmove convert claude-code xcode-claude`.
