# GAP-ROUND-24 — 第 8 客户端：Cline

日期：2026-08-05 · 参照物：Cline 官方文档 + cline/cline 仓库源码

## 1. 格式核实（证据）

- MCP：`~/.cline/data/settings/cline_mcp_settings.json`（`mcpServers` map）。
  官方 docs（cline-cli/configuration）与源码
  `resolveMcpSettingsPath()`（sdk/packages/shared/src/storage/paths.ts）一致；
  注意 docs 另有一处写 `~/.cline/mcp.json` 是错的（cline#11671 已确认代码
  从不读该路径）。
- 远程 server：`url` + `type: "streamableHttp" | "sse"`；缺省 type 按源码
  schema 回退为 legacy `sse`（cline#11670）。stdio：command/args/env，支持
  `disabled` 布尔。
- 全局规则：`~/Documents/Cline/Rules/*.md|.txt`；项目级 `.clinerules/*.md|.txt`。
- VS Code 扩展的 MCP 设置存于 VS Code globalStorage（与 CLI 路径不同），
  不迁移，导出时 warning 如实说明。

## 2. 实现

- 用户级 adapter `cline`：MCP（transport 双向归一化 streamableHttp↔http、
  缺省→sse；`disabled`↔portable enabled——8 客户端中唯一原生支持 disabled
  的 mcpServers-map 客户端）、Rules 目录拼接为 instructions；导入写
  `Rules/agentmove-imported.md`；memory/skills warning；persona 近似。
- 项目级 adapter：`.clinerules/*.md|.txt` 导出拼接 / 导入
  `.clinerules/agentmove-imported.md`；无项目级 MCP，warning。
- 全矩阵 e2e 扩至 8×8（56 方向）+ 全目标 round-trip。

## 3. 验证

- 65 测试全绿；build/lint/typecheck 通过；README/官网/man/completion 同步；
  minor changeset（随下次发版 0.5.0）。

## 4. 结论（诚实）

Cline CLI 路径为权威实现目标；VS Code 扩展内部存储不可迁移已成文。
Cascade/App-managed memory 类边界与既有客户端一致。
