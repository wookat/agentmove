# GAP-ROUND-39 — 第 17 客户端：VS Code（Copilot agent mode）

日期：2026-08-06 · 类型：开发版轮（生态触发）

## 1. 证据（官方文档实测调研）

- code.visualstudio.com/docs/copilot/customization/mcp-servers 确认：
  - 用户级 MCP：user profile 下的 `mcp.json`（"MCP: Open User
    Configuration"），根键 `servers`；stdio 用 command/args/env
    （type 可省略），remote 用 `type: "http"`/`"sse"` + url/headers。
  - 项目级：`.vscode/mcp.json`（官方建议入库共享）。
  - `inputs` 数组定义提示型占位符（client 专属）。
- api/extension-guides/ai/mcp 确认三种 transport：stdio/http/sse。
- profile 目录平台差异：`~/.config/Code/User`（Linux）、
  `~/Library/Application Support/Code/User`（macOS）、
  `%APPDATA%\Code\User`（Windows）。
- 价值判断：VS Code 是最大的编辑器生态，Copilot agent mode 的
  MCP 配置搬家（进/出 CLI 客户端）是高频真实场景。

## 2. 实现

- adapter `vscode`：三平台 profile 位置依次检查；`servers` 键
  merge 语义 + 脱敏 + `--replace-mcp`；`inputs` 原样保留并 warning；
  `envFile` 机器相关 dropped + warning；无 disabled flag warning。
- instructions/persona/memory/skills 用户级不可迁移，全部诚实
  warning（instructions 提示走 --project）。
- 项目级：`.vscode/mcp.json` + `.github/copilot-instructions.md`。
- 全矩阵 e2e 扩至 17×17（272 方向）+ 17 目标 round-trip。

## 3. 验证

build/lint/typecheck 通过；106 tests 全绿；website build 通过。
minor changeset 已加（合并后可发 0.15.0）。
