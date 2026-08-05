# GAP-ROUND-21 — 第 7 个客户端：Windsurf adapter

日期：2026-08-05 · 参照物：Windsurf 官方文档（docs.windsurf.com/plugins/cascade/mcp、/memories）

## 1. 差距

Windsurf 是主流 agent IDE 之一（roadmap 中期项排第一），此前不支持。
格式已按官方文档核实：

- MCP：`~/.codeium/windsurf/mcp_config.json`，`mcpServers` map；远程服务器用
  `serverUrl`（非 `url`）；仅全局配置，无项目级 MCP。
- 全局规则：`~/.codeium/windsurf/memories/global_rules.md`（≈instructions）。
- 项目规则：`.windsurf/rules/*.md`。
- Cascade memories：app 管理，不可导出/导入。
- 无 SKILL.md、无 persona 槽位。

## 2. 修复

新增 `windsurf` adapter（用户级 + `--project` 项目级）：

- 导出时 `serverUrl`→`url` 归一化，导入时反向渲染回 `serverUrl`。
- global_rules.md ↔ instructions；persona 近似追加并 warning。
- memories/skills 如实 warning 跳过。
- 全矩阵 e2e 扩为 7×7（42 方向）+ 7 目标 round-trip。
- README/官网/man/completion/clients 同步。

## 3. 验证

57 测试全绿（新增 windsurf 单测 3 + 矩阵扩展）；build/lint/typecheck 通过；
minor changeset 已加（0.4.0）。

## 4. 结论（诚实）

MCP 与规则层迁移完整；Cascade memories 是真实能力边界（app 数据库），
与 Cursor memories 同类，文档已如实标注。
