# GAP-ROUND-37 — 第 15 客户端：Amp（Sourcegraph）

日期：2026-08-06 · 类型：开发版轮（生态调研触发）

## 1. 证据（官方手册 ampcode.com/manual 实测调研）

- 用户设置：`~/.config/amp/settings.json`，MCP 在扁平键
  `"amp.mcpServers"` 下——local 用 `command`/`args`/`env`，remote 用
  `url`/`headers`（无 transport 字段，例：mcp.linear.app/sse）。
- 全局 instructions：`$HOME/.config/amp/AGENTS.md`（官方文档明确
  "always included if they exist"）。
- skills：官方优先级链含 `~/.agents/skills/`（通用标准）与项目
  `.agents/skills/`。
- workspace（项目级）MCP：`.amp/settings.json`，官方要求首次使用前
  `amp mcp approve` 显式批准。
- 价值判断：Amp 是 Sourcegraph 出品的主流 agent CLI/IDE，四层中
  MCP/instructions/skills 齐备，memory 无持久 store。

## 2. 实现

- 用户级 adapter `amp`：amp.mcpServers 读写（merge 语义、脱敏、
  无 disabled flag warning、SSE 降为普通 url 提示）；AGENTS.md；
  ~/.agents/skills；memory/persona 近似进 AGENTS.md（warning）。
- 项目级：`.amp/settings.json` workspace servers（导入时 warning
  提示需 amp mcp approve）+ `AGENTS.md` + `.agents/skills/`。
- 全矩阵 e2e 扩至 15×15（210 方向）+ 全目标 round-trip 15 个。

## 3. 诚实边界

- 无 disabled flag；remote 无 transport 字段（SSE/HTTP 均 url）；
  memory 无持久 store（近似 + warning）；`amp.` 前缀其他设置项
  原样保留在 settings.json 不迁移语义。

## 4. 验证

build/lint/typecheck 通过；99 tests 全绿；website build 通过。
minor changeset 已加（合并后可发 0.13.0）。
