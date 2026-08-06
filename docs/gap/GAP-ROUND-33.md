# GAP-ROUND-33 — 第 12 客户端：OpenCode

日期：2026-08-06 · 类型：开发版轮（竞品/生态调研触发）

## 1. 证据（官方文档实测调研）

- https://opencode.ai/docs/mcp-servers/ ：MCP 在
  `~/.config/opencode/opencode.json`（或 .jsonc）的 `mcp` 根键下；
  本地 server `type: "local"`，`command` 为 argv 数组（含参数），
  `environment` 环境变量，`enabled` 布尔；远程 `type: "remote"` + `url`。
  无 sse 类型。
- https://opencode.ai/docs/rules/ ：全局 instructions
  `~/.config/opencode/AGENTS.md`，项目级 `AGENTS.md`（兼容 Claude 的
  CLAUDE.md）。
- https://opencode.ai/docs/skills/ ：原生 SKILL.md：全局
  `~/.config/opencode/skills/<name>/SKILL.md`，项目
  `.opencode/skills/<name>/SKILL.md`。
- 价值判断：OpenCode 是当前最流行的开源 TUI coding agent 之一，
  MCP+rules+skills 三层齐备，是 SKILL.md 生态的重要一员，属高价值缺口。

## 2. 实现

- 用户级 adapter `opencode`：`mcp` 根键读写；`local/remote` ↔ 可移植
  `stdio/http` 双向归一；argv `command` 数组 ↔ `command`+`args` 拆合；
  `environment` ↔ `env`；`enabled: false` 双向保留（OpenCode 原生支持
  禁用标志）；sse 导入降级为 remote（warning）；cwd 不支持（warning）；
  AGENTS.md instructions；原生 skills 目录直迁；persona 近似（warning）；
  memory 无槽位（warning，建议 --mif）。
- 项目级：`opencode.json` + `AGENTS.md` + `.opencode/skills`。
- 全矩阵 e2e 扩至 12×12（132 方向）+ 全目标 round-trip 12 个。

## 3. 诚实边界

- OpenCode 无 sse 传输、无 cwd、无 durable memory；`opencode.jsonc`
  注释重写时不保留（warning）。

## 4. 验证

见 PR 记录：build/lint/typecheck/tests/coverage/website build。
minor changeset 已加（合并后可发 0.10.0）。
