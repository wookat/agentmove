# GAP ROUND-77 — Agent Plugins 1.0.0 interop

## Trigger (ecosystem event)

On 2026-08-06 the **Agent Plugins 1.0.0** specification launched at
[agent-plugins.org](https://agent-plugins.org): an open, vendor-neutral standard
for packaging Agent Skills and MCP servers into portable plugins, published by a
TSC with Core Maintainers from **Amazon, Cursor, Microsoft, OpenAI, and Vercel**
(Google joined as a Core Maintainer on launch day — see the
[Vercel announcement](https://vercel.com/blog/introducing-agent-plugins) and
[Google Developers Blog post](https://developers.googleblog.com/agent-plugins-package-your-skills-tools-and-more/)).

This is exactly AgentMove's territory: a portable interchange format for two of
our five layers, backed by the major clients we already migrate between.
Supporting it makes AgentMove both a producer (any of the 46 clients → a
standard plugin) and a consumer (any ecosystem plugin → any of the 46 clients).

## Spec facts used (normative source: agent-plugins.org/specification, v1.0.0)

- A plugin is a directory with a required `plugin.json` manifest; `$schema` MUST
  be `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` and `name` is
  required.
- Skills live under `skills/`, one subdirectory each, in the Agent Skills
  format we already read/write.
- MCP servers are declared in `mcp.json` (`$schema` + `mcpServers` map). Every
  entry carries an **explicit `type`**: `stdio` (command/args/env/cwd),
  `streamable-http` (url/headers), or `sse` (url/headers). The official
  `mcp.schema.json` confirms these are the only allowed shapes
  (`additionalProperties: false`).
- `cwd` MUST be plugin-relative (`./…`) or rooted at `${PLUGIN_ROOT}` /
  `${PLUGIN_DATA}` — absolute host paths are not allowed.
- There is no component slot for instructions, persona, or memory, and no
  per-server disabled flag.

## Mapping decisions

Export (`export <client> --plugin -o dir`):

- `plugin.json`: `$schema` + directory-basename `name` + generated description.
- Bundle skills → `skills/<name>/…` byte-for-byte.
- Bundle MCP servers → `mcp.json` with explicit types (`stdio` /
  `streamable-http` for our `http` transport / `sse`).
- Lossy edges, all warned honestly: absolute `cwd` dropped; `enabled: false`
  has no plugin representation (exported as enabled); instructions / persona /
  memory not written (bundle or `--mif` covers them); stdio entries without a
  command and remote entries without a url are skipped.

Import (`import <client> -i dir`, auto-detected via `plugin.json`):

- `mcp.json` entries → bundle servers; entries missing the required explicit
  `type` (or with an unknown type such as `websocket`) are dropped with a
  warning per the spec's validation rules.
- `skills/` → bundle skills.
- Unrecognized `$schema` values are read best-effort with a warning.

## Out of scope (recorded, not implemented)

- Reverse-domain client extension directories (`com.example.client/`) are
  client-owned by definition; AgentMove does not translate them.
- `${PLUGIN_ROOT}`/`${PLUGIN_DATA}` expansion is a client runtime concern, not
  a migration concern; values are passed through opaquely.
- Packaging AgentMove itself as a plugin registry/installer — distribution is
  explicitly left to each client by the spec.
