# GAP-ROUND-59: Vibe Code CLI (Mistral) adapter — 35th client

## Selection rationale

- Vibe Code CLI is Mistral's first-party open-source coding agent
  (github.com/mistralai/mistral-vibe), with full official docs for MCP
  servers, AGENTS.md, and Agent Skills — a clean, well-documented adapter
  target.
- Candidates rejected this round:
  - **Void editor**: repository is archived on GitHub (checked via API:
    `archived: true`, last push 2026-06) — no longer maintained.
  - **Aider**: still has no native MCP support in the released CLI (PR #3672
    never merged; issue #4506 open) — nothing stable to migrate.

## Official sources

- MCP servers: https://docs.mistral.ai/vibe/code/cli/mcp-servers
- Configuration: https://docs.mistral.ai/vibe/code/cli/configuration
- Skills: https://docs.mistral.ai/vibe/code/cli/skills
- Agents/AGENTS.md: https://docs.mistral.ai/vibe/code/cli/agents
- Source: https://github.com/mistralai/mistral-vibe

## Verified paths and formats

User scope (`~/.vibe/`, relocatable via `VIBE_HOME` — not followed):

```text
~/.vibe/
├── config.toml     # [[mcp_servers]] array of tables + general config
├── AGENTS.md       # user-level instructions
└── skills/         # Agent Skills standard (SKILL.md directories)
```

MCP entry format (array of tables, each with its own `name`):

```toml
[[mcp_servers]]
name = "filesystem"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]

[mcp_servers.env]
FS_API_KEY = "${FS_API_KEY}"

[[mcp_servers]]
name = "api-server"
transport = "http"
url = "https://mcp.example.com/mcp"

[mcp_servers.headers]
Authorization = "${Authorization}"
```

- `transport` is one of `stdio`, `http`, `streamable-http`. Both HTTP
  variants normalize to portable `http`; imports emit `transport = "http"`.
- Client-specific fields (warned on export, preserved on merge):
  `api_key_env`, `api_key_header`, `api_key_format`, `startup_timeout_sec`,
  `tool_timeout_sec`, `enabled_tools`, `disabled_tools`.
- No `sse` transport (SSE imports emitted as `http`, warned), no documented
  `cwd` (dropped, warned), no per-server disabled flag (warned).
- Project scope: `./.vibe/config.toml` (takes precedence over user config),
  root `AGENTS.md` (walked up from cwd), `./.vibe/skills/`.

## Deferred (documented, out of scope this round)

- `VIBE_HOME` relocation.
- `.agents/skills/` project discovery path (belongs to the generic
  `.agents` resource layer, already covered for antigravity/codex targets;
  not duplicated for vibe to avoid double writes).
- Custom agent profiles (`~/.vibe/agents/*.toml`), prompts, custom tools,
  `skill_paths`/`enabled_skills`/`disabled_skills` config filters.
- `.env` credentials in `~/.vibe/.env` (never migrated).
- Connectors (Mistral-managed integrations, server-side).
