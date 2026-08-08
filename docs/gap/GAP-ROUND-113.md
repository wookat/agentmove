# GAP-ROUND-113 — commands layer for Cortex Code (Snowflake CoCo)

## Evidence

- CoCo CLI reference: https://docs.snowflake.com/en/user-guide/cortex-code/cli-reference
  - Documented install layout includes `~/.snowflake/cortex/commands/`
    ("Custom commands") alongside `skills/`, `hooks/`, `profiles/`.
  - Slash command `/commands`, `/cmds` — "Manage custom commands".
- CoCo settings doc: https://docs.snowflake.com/en/user-guide/cortex-code/settings
  - Full config-directory layout again lists `commands/  # Custom commands`.
- CoCo plugins doc: https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-plugins
  - Plugins bundle "Slash commands — Project-style commands invoked from the
    CoCo CLI prompt" as `commands/*.md` markdown files (auto-discovered
    `./commands` subdirectory), confirming the markdown command format.
- CoCo Desktop plugins doc:
  https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-desktop/plugins
  - CoCo Desktop converts older Claude Code style `commands/` plugin entries
    to skills — desktop-side commands are being folded into skills, but the
    CLI keeps `~/.snowflake/cortex/commands/` and the `/commands` manager.

## Decision

- **User scope:** export/import `~/.snowflake/cortex/commands/**/*.md`
  recursively, nested names preserved, content byte-faithful. Frontmatter
  and argument conventions from other clients are client-specific — warned
  on import.
- **Project scope:** no standalone project commands directory is documented
  (project commands ship only inside plugins, which agentmove does not
  unpack into `.cortex/`); the cortex project adapter does not claim
  `supportsCommands`, so project-scope imports with commands emit the
  standard "no custom commands directory at project scope; skipped"
  warning and project exports carry none.

## Deferred / not migrated

- **Plugin-bundled commands** (`<plugin>/commands/*.md` under a
  `.cortex-plugin/`/`.claude-plugin/` manifest) belong to the plugin unit —
  agentmove's existing `--plugin` interop covers plugin archives; unpacking
  a plugin's commands into the user commands root would change ownership.
- **Bundled/built-in slash commands** (`/sql`, `/plan`, `/skill`, …) are
  product features, not files.
- Cortex remote/git-shared skills and Snowflake-catalog sharing are
  runtime/cloud features, not local files.

## Other candidates reviewed this round

- **Amp**: custom commands (`.agents/commands/`, `~/.config/amp/commands/`)
  were **removed** in favor of skills
  (https://ampcode.com/news/slashing-custom-commands) — importing commands
  as files Amp no longer reads would be dishonest; a documented
  commands→skills conversion is a possible future round.
- **Grok CLI** (superagent-ai): no custom commands directory in the official
  README/DeepWiki (skills + subagents only). Deferred.
- **Kimi Code CLI**: commands still ship via plugins only. Unchanged from
  GAP-ROUND-107.
