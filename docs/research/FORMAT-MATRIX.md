# FORMAT-MATRIX — 六客户端存储格式矩阵

> 逐一核实于各官方文档，采集日期 2026-08-04。这是 adapter 实现的直接依据；实现时以本机真实文件再次校验（doctor 命令内置探测）。

## 总矩阵

| 层 | OpenClaw | Hermes Agent | Claude Code | Codex CLI | Cursor | Gemini CLI |
|----|----------|--------------|-------------|-----------|--------|------------|
| 根目录 | `~/.openclaw/`（legacy `~/.clawdbot/`、`~/.moltbot/`） | `~/.hermes/` | `~/.claude/` + `~/.claude.json` | `~/.codex/`（`CODEX_HOME` 可覆盖） | `~/.cursor/` + 项目 `.cursor/` | `~/.gemini/` |
| 主配置 | `openclaw.json`（JSON5） | `config.yaml`（YAML） | `settings.json`；项目 `.claude/settings.json`、`settings.local.json` | `config.toml`（TOML）；项目 `.codex/config.toml` | 应用设置为主；项目侧 `.cursor/` | `settings.json`；项目 `.gemini/settings.json` |
| MCP servers | `openclaw.json` → `mcp.servers.*`（command/args/env 或 url+transport: streamable-http\|sse、headers、toolFilter） | `config.yaml` → `mcp_servers.*`（command/args/env/cwd/url/tools.include/exclude） | 用户 `~/.claude.json` → `mcpServers`；项目 `.mcp.json` → `mcpServers`（type: stdio/http/sse） | `config.toml` → `[mcp_servers.<name>]`（command/args/env/cwd 或 url/http_headers、enabled） | `~/.cursor/mcp.json` 或 `.cursor/mcp.json` → `mcpServers` | `settings.json` → `mcpServers`；extensions 的 `gemini-extension.json` 亦可带 mcpServers |
| 全局指令 | workspace `AGENTS.md`（+`TOOLS.md`） | `AGENTS.md`（位置由 `--workspace-target` 决定/工作区） | `~/.claude/CLAUDE.md`；项目 `CLAUDE.md` 或 `.claude/CLAUDE.md`、`CLAUDE.local.md` | `~/.codex/AGENTS.md`（`AGENTS.override.md` 优先）；项目逐级 `AGENTS.md` 合并（32KiB 上限 `project_doc_max_bytes`） | `.cursor/rules/*.mdc`（frontmatter: description/globs/alwaysApply）+ 支持 `AGENTS.md`；legacy `.cursorrules` | `~/.gemini/GEMINI.md`；项目 `GEMINI.md`（`context.fileName` 可改名，`context.importFormat` 支持 import） |
| persona | workspace `SOUL.md` | `~/.hermes/SOUL.md` | 无独立 persona 文件（并入 CLAUDE.md，**有损点**） | 无（并入 AGENTS.md，**有损点**） | 无（并入 rules，**有损点**） | 无（并入 GEMINI.md，**有损点**） |
| memory | workspace `MEMORY.md`（长期）+ `memory/YYYY-MM-DD.md`（daily）+ `USER.md`（用户画像）；lowercase `memory.md` 为 legacy | `~/.hermes/memories/MEMORY.md`、`USER.md`（`§` 分隔条目，合并去重） | auto memory（`~/.claude/` 下项目级自动记忆）+ CLAUDE.md 手工记忆（`/memory`） | Memories 功能（`~/.codex/memories`，版本演进中——实现时以 doctor 探测为准，**待本机核验**） | Memories 功能（应用内数据库，**文件级不可携出，有损点：仅可导出我们可见的 rules**） | `/memory add` 追加到 `~/.gemini/GEMINI.md`（"Gemini Added Memories" 节） |
| skills | workspace `skills/`、`~/.openclaw/skills/`、`~/.agents/skills/`、workspace `.agents/skills/`（4 处，SKILL.md） | `~/.hermes/skills/`（SKILL.md） | `~/.claude/skills/`、项目 `.claude/skills/`（SKILL.md；commands 已并入 skills 机制） | `~/.agents/skills/`、项目 `.agents/skills/`（SKILL.md，progressive disclosure） | `.cursor/` 侧规则/命令近似；无标准 skills 目录（**有损点→转 rules 或 AGENTS.md 附录**） | extensions（`~/.gemini/extensions/<n>/gemini-extension.json` + `contextFileName`）近似承载（**近似映射**） |
| 密钥 | `.env` + config 内 apiKey/SecretRef + `credentials/` | `.env`（allowlisted keys） | keychain/env；`.mcp.json` 支持 `${VAR}` 引用 | `auth.json` / env | 应用内 | env / `.env` |
| 会话/历史 | `~/.openclaw/agents/<id>/sessions/` | `~/.hermes/`（backups 亦在此） | `~/.claude/` projects 历史 | `~/.codex/sessions` | 应用内 | `~/.gemini/tmp` 等 |

## 迁移策略要点（按层）

1. **MCP**：全部同构 → canonical model（复用 agentgate：name/transport/command/args/env/cwd/url/headers/enabled）近无损；差异点：Codex TOML `http_headers`、OpenClaw `transport: streamable-http` 与 toolFilter、Gemini extensions 内嵌 servers（导出时并入，导入时写 settings.json 并警告）。
2. **instructions**：Markdown 直搬 + 改名（AGENTS.md ↔ CLAUDE.md ↔ GEMINI.md）；Cursor 侧生成 `.cursor/rules/agentmove-imported.mdc`（alwaysApply: true）或 AGENTS.md。
3. **persona**：SOUL.md 仅 OpenClaw/Hermes 原生；导入其它客户端时作为章节合入 instructions 并报告「approximated」。
4. **memory**：双轨——`memory/raw/` 保留原文（无损回放同类客户端）；`memory/memory.json` 结构化条目（source/date/content，PAM 兼容字段），供跨范式导入（如写入 GEMINI.md 附记节、Hermes `§` 条目）。
5. **skills**：SKILL.md 目录级复制（含 scripts/assets）；冲突策略 skip/overwrite/rename（对齐 hermes 交互习惯）；Cursor/Gemini 为近似映射并报告。
6. **config 行为设置**：只映射高价值公共子集（默认模型、approval/sandbox 模式等），其余保留在 bundle `config.json.raw` 并在报告中列出未迁移项——不做全量硬映射（hermes 的逐键映射表证明可行但维护成本高，v0 收敛范围）。

## 未验证/待本机核验清单

- Codex memories 的确切文件布局（文档确认功能存在，路径以 doctor 实测为准）。
- Cursor Memories 的可导出性（当前判定：不可文件级导出，标注有损）。
- OpenClaw `workspace-main/`、`workspace-<agentId>` 多工作区变体（hermes 迁移文档证实存在，adapter 需多路径探测）。
