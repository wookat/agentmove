# GAP-ROUND-20 — 项目级迁移 `--project`

日期：2026-08-04 · 参照物：Claude Code `.mcp.json`、Cursor `.cursor/rules`、Codex/Gemini 项目文件约定

## 1. 差距

真实用户高频场景：同一个 repo 里的 agent 配置（`.mcp.json`、`CLAUDE.md`、
`.cursor/rules/*.mdc`、`GEMINI.md`、`AGENTS.md`）要跟人一起换客户端。
v0.2 只迁 `$HOME` 用户级配置，cursor adapter 甚至在 warning 里承诺
「run agentmove in a project for project rules (planned)」。**P1 功能缺口**
（roadmap 近期项）。

## 2. 修复

新增 `--project <dir>`（export/import/convert）：

| client | 项目文件 |
|---|---|
| claude-code | `.mcp.json`、`CLAUDE.md`、`.claude/skills/` |
| codex | `AGENTS.md`、`.agents/skills/`（无项目级 MCP，warning 提示走用户级） |
| gemini | `.gemini/settings.json`、`GEMINI.md` |
| cursor | `.cursor/mcp.json`、`.cursor/rules/*.mdc`（导出时拼接为 instructions） |

MCP merge 语义、secret 脱敏、dry-run、备份（`<dir>/.agentmove/backups`）与
用户级一致。openclaw/hermes 无项目级文件 → usage error（exit 2），如实报错
不假装支持。completion/man/README/官网文档同步更新。

## 3. 验证

- e2e：真实 fixture 项目 claude-code→cursor `--apply`（验证 mcp.json 合并、
  Authorization 脱敏、rules 写入）、→gemini、→codex（AGENTS.md+skills 迁移、
  MCP warning）、openclaw `--project` exit 2。
- 46 测试全绿；build/lint/typecheck 通过。

## 4. 结论（诚实）

repo 级搬家场景补齐，cursor 的「planned」承诺兑现；memory/persona 无项目级
槽位的客户端一律 warning 跳过而非近似写入（项目文件通常进 git，避免污染）。
