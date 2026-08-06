---
"agentmove-cli": minor
---

New client: Antigravity (Google) — 22nd supported client. Reads/writes the `mcpServers` map in `~/.gemini/config/mcp_config.json` (stdio: `command`/`args`/`env`/`cwd`; remote servers use Antigravity's required `serverUrl` field plus `headers`; native `disabled` flag round-trips as portable `enabled: false`), migrates Agent Skills in `~/.gemini/config/skills/`, and supports project scope (`.agents/mcp_config.json` + `.agents/rules/` + `.agents/skills/`). Client-specific `disabledTools`/`authProviderType`/`oauth` settings are reported as warnings; global rules live in `~/.gemini/GEMINI.md` (shared with Gemini CLI) so the user-scope instructions layer stays owned by the `gemini` client, and the absence of a durable memory store is warned.
