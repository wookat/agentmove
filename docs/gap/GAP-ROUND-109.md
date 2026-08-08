# Gap analysis — Round 109: commands for Continue and VS Code

## Continue (continue.dev)

Sources:

- https://docs.continue.dev/customize/deep-dives/prompts
- https://docs.continue.dev/reference/ (config.yaml `prompts:` blocks)
- Source: `continuedev/continue` — `core/promptFiles/index.ts`
  (`DEFAULT_PROMPTS_FOLDER_V2 = ".continue/prompts"`,
  `DEFAULT_PROMPTS_FOLDER_V1 = ".prompts"`), `core/promptFiles/getPromptFiles.ts`
  (walkDir recursive; reads `.prompt` and `.md`; also reads the global
  `~/.continue/prompts` and `~/.continue/rules` folders).

Verified behavior:

- Global prompt files: `~/.continue/prompts/` (markdown; `invokable: true`
  frontmatter exposes the file as a `/` slash command in IDE + `cn` CLI).
- Workspace prompt files: `.continue/prompts/` (V2 default); `.prompts` is the
  legacy V1 workspace folder, only scanned when a v1 config is in use.
- Discovery is recursive (`walkDir`), so nested paths are kept as-is.
- Legacy `.prompt` files (v1 format with `<system>` blocks and its own
  templating) are still read alongside `.md`.

AgentMove mapping:

- commands layer reads `~/.continue/prompts/**/*.md` recursively (nested names
  preserved); project scope reads `.continue/prompts/`.
- Legacy `.prompt` files use the v1 prompt-file format and are not portable
  markdown commands: warned per file, not migrated.
- `~/.continue/rules/` stays owned by the instructions layer (Continue also
  surfaces rules files as prompts, but migrating them twice would duplicate
  content).
- Frontmatter (`name`/`description`/`invokable`) is client-specific and copied
  as-is, with a warning that Continue only lists a file as a slash command when
  `invokable: true` is present.

Deferred (documented, not migrated):

- Hub prompt blocks referenced from `config.yaml` `prompts:` (`uses: owner/slug`)
  are remote references, not local files.
- Legacy `.prompts` V1 workspace folder.

## VS Code (Copilot prompt files)

Sources:

- https://code.visualstudio.com/docs/copilot/customization/prompt-files
- https://github.com/microsoft/vscode-copilot-chat —
  `assets/prompts/skills/agent-customization/references/prompts.md`
  (`.github/prompts/*.prompt.md` workspace; `<user data>/prompts/*.prompt.md`
  user profile)
- https://github.com/microsoft/vscode/issues/319338 (maintainer comment: the
  user-data customization folder is `User/prompts/` and holds all
  customization types)

Verified behavior:

- Workspace prompt files: `.github/prompts/*.prompt.md`.
- User-profile prompt files: `<profile folder>/prompts/*.prompt.md` — for the
  default profile that is `~/.config/Code/User/prompts` (Linux),
  `~/Library/Application Support/Code/User/prompts` (macOS),
  `%APPDATA%\Code\User\prompts` (Windows). The same folder also holds other
  customization types (`*.agent.md`, `*.instructions.md`, `*.chatmode.md`),
  so only `*.prompt.md` files are commands.
- Frontmatter: `description`, `name`, `argument-hint`, `agent`, `model`,
  `tools`; the folder is flat (no documented nested discovery).

AgentMove mapping:

- commands layer reads `*.prompt.md` from the default-profile `User/prompts`
  folder (same platform candidates as the existing `mcp.json` lookup); project
  scope reads/writes `.github/prompts/*.prompt.md`.
- Import writes flat `<name>.prompt.md` files; nested bundle names are
  flattened with the standard warning.
- Frontmatter is client-specific and copied as-is with a warning; the user
  folder is also synced by Settings Sync (warned on import).

Deferred (documented, not migrated):

- Non-default VS Code profiles (profile folders are id-based and app-managed).
- Other customization types in `User/prompts` (agents/instructions/chatmodes)
  belong to their own layers.
- `chat.promptFilesLocations` extra workspace locations (setting-driven).
