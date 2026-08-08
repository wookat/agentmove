---
title: Commands
description: The five AgentMove commands.
---

## `agentmove export <client> [-o dir] [--json]`

Reads the client's config, MCP servers, instructions, persona, memory, and
skills into a portable bundle directory (default `./agentmove-bundle`).
Likely secrets are redacted to `${VAR}` placeholders unless `--include-secrets`.

## `agentmove import <client> [-i dir] [--apply] [--replace-mcp] [--only layers] [--json]`

Plans the file writes needed to apply a bundle to a client. Dry-run by
default: prints each file that would be written. With `--apply`, existing
files are first backed up to `~/.agentmove/backups/<timestamp>/`.

Imported MCP servers are **merged** into the target's existing server list
(like the official `mcp add` commands) — servers the target already has are
never removed. Same-name conflicts are won by the imported entry, with a
warning. Pass `--replace-mcp` to replace the list entirely instead.

## `agentmove convert <from> <to> [--apply] [--replace-mcp] [--only layers] [--json]`

`export` + `import` in one step, without leaving a bundle on disk. Uses the
same MCP merge semantics as `import`.

## Partial migration: `--only`

`export`, `import`, and `convert` accept `--only <layers>` — a comma-separated
subset of `mcp`, `skills`, `memory`, `instructions`, `persona` — to migrate
only those layers. For example, to copy just the MCP servers from Claude Code
to Codex without touching instructions or skills:

```bash
agentmove convert claude-code codex --only mcp --apply
```

Unknown layer names fail with exit code 2.

## Project-scoped migration: `--project`

`export`, `import`, and `convert` accept `--project <dir>` to operate on the
client's **project-scoped** files inside a repository instead of the
user-scoped config under `$HOME`:

| Client | Project files |
|---|---|
| claude-code | `.mcp.json`, `CLAUDE.md`, `.claude/skills/` |
| codex | `AGENTS.md`, `.agents/skills/` (no project-scoped MCP config — warned) |
| gemini | `.gemini/settings.json`, `GEMINI.md` |
| cursor | `.cursor/mcp.json`, `.cursor/rules/*.mdc` |
| windsurf | `.windsurf/rules/*.md`, `.windsurf/skills/` (no project-scoped MCP config — warned) |
| copilot | `.mcp.json`, `.github/copilot-instructions.md` + `.github/instructions/`, `.github/skills/`, `.github/agents/`, `.claude/commands/` |
| cline | `.clinerules/*.md`, `.cline/skills/` (no project-scoped MCP config — warned) |
| warp | `.warp/.mcp.json`, `AGENTS.md` (legacy `WARP.md` read), `.warp/skills/` |

```bash
# move a repo's Claude Code setup to Cursor, in place
agentmove convert claude-code cursor --project . --apply
```

Backups go to `<dir>/.agentmove/backups/<timestamp>/`. MCP merge semantics and
secret redaction work the same as user-scoped migration. OpenClaw and Hermes
have no project-scoped files — `--project` with them is a usage error (exit 2).

## Memory interchange: `--mif`

`export --mif <file>` additionally writes the memory layer as a vendor-neutral
[MIF v2](https://github.com/varun29ankuS/mif-spec) document (`mif_version`,
`memories[]` with `id`/`content`/`created_at`), so memories can be handed to
any MIF-speaking memory system. `import <client> --mif <file>` imports the
memory layer from a MIF document instead of a bundle:

```bash
agentmove export openclaw -o bundle --mif memories.mif.json
agentmove import gemini --mif memories.mif.json --apply
```

MIF fields with no portable equivalent (embeddings, knowledge-graph data) are
dropped with a warning; a non-MIF file is a data error (exit 3).

## Agent Plugins interop: `export --plugin`

`export <client> --plugin -o <dir>` writes an
[Agent Plugin](https://agent-plugins.org) (the vendor-neutral 1.0.0 standard from
Amazon, Cursor, Google, Microsoft, OpenAI, and Vercel) instead of an agentmove
bundle: `plugin.json` manifest, `skills/` in the Agent Skills format, and
`mcp.json` with an explicit `type` (`stdio` / `streamable-http` / `sse`) on every
server. `import -i <dir>` auto-detects a directory containing `plugin.json` and
imports its MCP servers and skills into any supported client:

```bash
agentmove export claude-code --plugin -o my-agent-plugin
agentmove import codex -i some-plugin-from-the-ecosystem --apply
```

If `-o` ends in `.zip`, `.tgz`, or `.tar.gz`, the plugin is packaged as a
ready-to-publish archive (e.g. a GitHub release asset) instead of a
directory — the plugin name is the filename without the suffix:

```bash
agentmove export claude-code --plugin -o my-agent-plugin.zip
```

Agent Plugins has no slot for instructions, persona, or memory — those layers
are skipped with a warning (use a bundle or `--mif` for them). An absolute MCP
`cwd` is dropped with a warning (the spec only allows plugin-relative or
`${PLUGIN_ROOT}`/`${PLUGIN_DATA}` working directories), and entries without an
explicit `type` in an imported plugin are reported and dropped.

## Standalone MCP config import: `import -i mcp.json`

`import -i` also accepts a bare `.json` file containing an `mcpServers` map —
an Agent Plugins `mcp.json` on its own, a Claude-style `.mcp.json`, or a
hand-maintained canonical server list shared by a team:

```bash
agentmove import cursor -i team-mcp.json          # preview
agentmove import cursor -i team-mcp.json --apply  # merge into the client
```

Transports come from an explicit `type` or `transport` field
(`stdio` / `streamable-http` / `http` / `sse`); when omitted they are inferred —
`command` means stdio, `url` means Streamable HTTP — with a warning naming the
inference. Entries that are neither are reported and dropped. Normal merge
semantics, dry-run, and backups apply; a `.json` file without `mcpServers` is a
data error (exit 3).

## Importing from a URL: `import -i https://…`

`-i` also accepts an http(s) URL, so a team can share one canonical source and
everyone imports straight from it:

```bash
# a hosted mcp.json (raw GitHub URL, internal server, …)
agentmove import cursor -i https://raw.githubusercontent.com/acme/dev/main/team-mcp.json

# a git repository containing an Agent Plugin, an agentmove bundle, or skills
agentmove import claude-code -i https://github.com/acme/team-plugin
agentmove import cursor -i https://github.com/vercel-labs/agent-skills
```

A URL ending in `.json` is fetched and treated as a standalone MCP config; any
other URL is `git clone`d (shallow) and auto-detected — an Agent Plugin
(`plugin.json` at the root), an agentmove bundle, or a skills repository
(see below). Plain-`http` URLs work but
emit an insecure-URL warning. Fetch/clone failures are data errors (exit 3).
The usual dry-run/`--apply`, merge, and backup semantics apply.

A GitHub-style **tree URL** narrows the import to one branch and directory —
handy for repos that carry many skills when you only want one:

```bash
# just this skill directory, from the main branch
agentmove import claude-code -i https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
```

The repository is cloned at that branch and the directory goes through the same
auto-detection (a directory with a `SKILL.md` imports as a single skill). The
branch is taken as the first path segment after `/tree/`, so branch names
containing slashes cannot be addressed this way; a missing directory is a data
error (exit 3).

GitLab-style URLs work too — the `/-/` marker allows arbitrarily nested
subgroups (`https://gitlab.com/group/subgroup/repo/-/tree/main/skills/web`).
And a pasted **blob** link to a `.json` file is rewritten to the raw file it
renders, so `https://github.com/acme/dev/blob/main/team-mcp.json` (or GitLab's
`/-/blob/`) fetches the config instead of the HTML page.

## Importing an archive: `import -i <file-or-url>.zip`

`-i` also accepts a `.zip`, `.tgz`, or `.tar.gz` archive — a GitHub release
asset, a repository "Download ZIP" link, or a local file:

```sh
# a plugin or skills repository shipped as a release asset
agentmove import cursor -i https://github.com/acme/skills/archive/refs/heads/main.zip

# a local archive
agentmove import codex -i ./my-plugin.zip
```

The archive is downloaded (for URLs) and extracted, a single top-level wrapper
directory (the GitHub archive layout) is unwrapped, and the contents go
through the same auto-detection: Agent Plugin, agentmove bundle, skills
repository, or standalone `mcp.json`. A corrupt or unreadable archive is a
data error (exit 3). Extraction uses the system `tar` (and `unzip` where
available), which is preinstalled on Linux, macOS, and Windows 10+.

## Importing a skills repository: `import -i <repo>`

`-i` also accepts a **skills repository** — the layout used across the
[skills.sh](https://skills.sh) / `npx skills add owner/repo` ecosystem (Vercel's
`agent-skills`, Google's `agents-cli`, Anthropic's `skills`, …). A directory (or
cloned URL) that is neither an Agent Plugin nor an agentmove bundle is treated
as a skills repository when it carries `SKILL.md` skills in any of the common
shapes:

- `skills/<name>/SKILL.md` — the conventional `skills/` folder
- `skills/<scope>/<name>/SKILL.md` — namespaced skills (the `gh skill` /
  `github/awesome-copilot` convention); on a name clash across namespaces the
  later skill is imported as `<scope>-<name>` with a warning
- `<name>/SKILL.md` — skill directories at the repository top level
- a single `SKILL.md` at the repository root (named from its frontmatter
  `name:`, falling back to the directory name)

```bash
# straight from GitHub into any client's skills location
agentmove import claude-code -i https://github.com/vercel-labs/agent-skills
agentmove import cursor -i ./my-skills-repo --apply
```

Only directories that actually contain a `SKILL.md` are imported; everything
else in the repository is ignored. The usual dry-run/`--apply`, `--only skills`,
and backup semantics apply, and the import reports how many skills were found.

## Skills repository export: `export --skills-repo`

The reverse direction: `export <client> --skills-repo <dir>` also writes the
skills layer as a skills repository in the conventional
`skills/<name>/SKILL.md` layout — ready to commit and publish with
`gh skill publish`, install with `npx skills add`, or import back with
`agentmove import -i`:

```bash
agentmove export claude-code --skills-repo ./my-skills
agentmove export claude-code --skills-repo my-skills.zip   # as an archive
```

A path ending in `.zip`/`.tgz`/`.tar.gz` packages the repository as an archive
(one top-level directory named after the file without the suffix). Exporting a
client with no skills is a data error (exit 3).

Skills that were installed with `gh skill install` carry source-tracking
metadata (`metadata.github-*` keys) in their `SKILL.md` frontmatter, which
`gh skill publish` rejects. `--skills-repo` strips those keys on export (with
a warning per skill, mirroring `gh skill publish --fix`); all other
frontmatter and file contents are left byte-identical.

## Standalone MCP config export: `export --mcp-json`

The reverse direction: `export <client> --mcp-json <file>` also writes the MCP
layer as a standalone standard `mcp.json` — an explicit `type` on every entry
(`stdio` / `streamable-http` / `sse`), stamped with the Agent Plugins MCP
schema, secrets redacted to `${VAR}` placeholders by default:

```bash
agentmove export claude-code --mcp-json team-mcp.json
```

The result is a shareable canonical server list any teammate can import into
their own client (`import <client> -i team-mcp.json`) or feed to any other
`mcpServers`-speaking tool. Unlike a plugin's `mcp.json`, a standalone file
keeps `cwd` values; a disabled server is exported as enabled with a warning
(the format has no disabled flag).

## Encrypted transport: `pack` / `unpack`

`pack <bundle> [-o file]` encrypts a bundle directory into a single portable
`.agentpack` file (AES-256-GCM, key derived from the `AGENTMOVE_PASSPHRASE`
environment variable via scrypt) so an agent can be carried across machines
safely — including through untrusted channels like mail or cloud drives.
`unpack <file> [-o dir]` decrypts it back into a bundle directory, and
`import -i` accepts an `.agentpack` file directly:

```bash
AGENTMOVE_PASSPHRASE='...' agentmove export openclaw -o bundle
AGENTMOVE_PASSPHRASE='...' agentmove pack bundle -o agent.agentpack
# on the other machine
AGENTMOVE_PASSPHRASE='...' agentmove import claude-code -i agent.agentpack --apply
```

A missing passphrase is a usage error (exit 2); a wrong passphrase or tampered
file fails authentication and is a data error (exit 3). Note that exported
bundles redact likely secrets by default — encryption is for everything else
(instructions, memory, persona, server lists). If you pack a bundle exported
with `--include-secrets`, the ciphertext protects them in transit, but treat
the passphrase accordingly.

## `agentmove diff <from> <to> [--json]`

Layer-by-layer structural comparison between two clients, or between a bundle
directory and a client. Output uses `+` (added), `-` (removed), `~` (changed).

## `agentmove clients [--json]`

Lists the supported clients with their ids and default config locations
(like pandoc's `--list-input-formats`).

## `agentmove completion <bash|zsh|fish>`

Prints a shell completion script covering commands, client ids, and flags.
Enable it with:

```bash
eval "$(agentmove completion bash)"                    # bash / zsh
agentmove completion fish | source                     # fish
```

## `agentmove doctor [--json]`

Detects which supported clients are configured on this machine and inventories
what AgentMove can migrate from each (MCP servers, skills, memory entries,
instructions, persona), including any format warnings.

## Man page

A global install (`npm i -g agentmove-cli`) also links a man page:
`man agentmove-cli`.

## Global options

- `--home <dir>` — override the home directory (useful for testing and staging).
- `--only <layers>` (on `export`, `import`, `convert`) — migrate only the
  listed layers (`mcp,skills,memory,instructions,persona`).
- `--project <dir>` (on `export`, `import`, `convert`) — operate on the
  client's project-scoped files in a repository instead of `$HOME`.
- `--mif <file>` (on `export`, `import`) — exchange the memory layer as a
  MIF v2 document.
- `--plugin` (on `export`) — write an Agent Plugin instead of an agentmove
  bundle; an `-o` ending in `.zip`/`.tgz`/`.tar.gz` packages it as an archive.
- `--debug` (or `AGENTMOVE_DEBUG=1`) — print a full stack trace on unexpected
  errors; by default errors are a single readable line.
- `--json` (on `export`, `import`, `convert`, `diff`, `pack`, `unpack`, `doctor`, `clients`) — machine-readable JSON on
  stdout for scripts and CI: the migration plan, warnings, per-layer summary,
  and backup directory. After `--apply`, the human output also ends with a
  `migrated: …` per-layer summary line.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | success |
| 1 | unexpected error (permission errors include remediation guidance) |
| 2 | usage error (e.g. unknown client) |
| 3 | bad input data (missing/corrupt bundle or config; the message includes the offending file path) |
