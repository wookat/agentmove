# GAP-ROUND-31 — 第 11 客户端：GitHub Copilot CLI

日期：2026-08-05 · 类型：开发版轮（生态证据触发）

## 1. 证据（官方文档实测调研）

- VS Code 官方文档明确：Agent Host / Copilot 工具链的可移植用户级配置是
  `~/.copilot/mcp-config.json`（VS Code 转发 `.vscode/mcp.json`，但 Agent Host
  原生读取的是 `~/.copilot/mcp-config.json`）。
  https://code.visualstudio.com/docs/agents/reference/mcp-configuration
- Copilot CLI 官方文档/教程：用户级 MCP `~/.copilot/mcp-config.json`
  （`mcpServers`，stdio 拼写 `"type": "local"`，可带 `tools` 允许列表）；
  项目级 `.mcp.json`（`mcpServers`）。
  https://github.com/github/copilot-cli-for-beginners（06-mcp-servers）
- github-mcp-server 官方安装指南给出远程 server 格式：
  `"type": "http", "url": ..., "headers": {"Authorization": "Bearer ..."}`。
- 用户级 instructions：`~/.copilot/copilot-instructions.md` +
  `~/.copilot/instructions/**/*.instructions.md`；项目级
  `.github/copilot-instructions.md` + `.github/instructions/`。
  https://code.visualstudio.com/docs/copilot/customization/custom-instructions
- 价值判断：Copilot 是装机量最大的 AI 编程助手；对「避免厂商锁定」的中立
  迁移工具，这是当前生态里最高价值的缺失客户端。

## 2. 实现

- 新 adapter `copilot`（用户级）：MCP `local`↔`stdio` 归一化、merge 语义、
  `tools` 允许列表按诚实原则 warning（非 `["*"]` 时）、无 disabled 标志 warning、
  cwd 不支持 warning；instructions 双源合并导出，导入写
  `~/.copilot/instructions/agentmove-imported.instructions.md`；
  persona 近似进 instructions（warning）；memory/skills 无对应（warning）。
- 项目级 adapter：`.mcp.json`（`type: local` 拼写）+
  `.github/copilot-instructions.md` + `.github/instructions/` 导出，导入写
  `.github/instructions/agentmove-imported.instructions.md`。
- 全矩阵 e2e 扩至 11×11（110 方向）+ 全目标 round-trip 11 个。

## 3. 诚实边界

- Copilot 会话历史/app 内状态不可迁移；`tools` 允许列表是客户端特有语义，
  导出时 warning 报告而非静默丢弃；无 durable memory 槽位（建议 --mif）。

## 4. 验证

85 测试全绿；coverage 82.40/66.23；build/lint/typecheck/website build 通过；
doctor/convert 真实 fixture 冒烟通过（见上方命令输出记录于 PR）。
minor changeset 已加（合并后可发 0.9.0）。
