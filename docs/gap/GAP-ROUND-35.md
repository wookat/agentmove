# GAP-ROUND-35 — 第 14 客户端：goose（Block）

日期：2026-08-06 · 类型：开发版轮（竞品/生态调研触发）

## 1. 证据（官方文档 + 源码实测调研）

- https://goose-docs.ai/docs/guides/config-files/ ：
  用户配置 `~/.config/goose/config.yaml`，MCP 即 `extensions` 键——
  stdio 用 `cmd`/`args`/`envs`，远程 `streamable_http`/`sse` 用 `uri`/
  `headers`；`enabled` 标志原生；`builtin`/`platform`/`frontend`/
  `inline_python` 为 goose 内部扩展类型（非 MCP）。
- https://goose-docs.ai/docs/guides/context-engineering/using-goosehints/ ：
  全局 instructions `~/.config/goose/.goosehints`，项目级 `.goosehints`。
- https://goose-docs.ai/docs/guides/context-engineering/using-skills/ ：
  skills 用 `~/.agents/skills/`（推荐标准）+ 项目 `.agents/skills/`。
- 源码（block/goose crates/goose-mcp/src/memory/mod.rs）：memory 扩展把
  记忆存成 `<category>.txt`（全局 `~/.config/goose/memory/`、项目
  `.goose/memory/`），条目空行分隔，`# tag` 行为标签。
- 价值判断：goose 是 Block 出品、GitHub 高星的主流开源 agent，
  MCP+instructions+durable memory+skills 四层齐备。

## 2. 实现

- 用户级 adapter `goose`：extensions 读写（merge 语义、脱敏、原生
  enabled、builtin/platform 跳过、available_tools/env_keys/非默认
  timeout 显式 warning）；.goosehints instructions；memory/*.txt →
  memory 层双向（导入写 memory/imported.txt）；~/.agents/skills 直迁。
- 项目级：`.goosehints` + `.goose/memory/` + `.agents/skills/`；
  goose extensions 无项目级配置，MCP 在项目 scope 明确 warning。
- 全矩阵 e2e 扩至 14×14（182 方向）+ 全目标 round-trip 14 个。

## 3. 诚实边界

- builtin/platform 扩展是 goose 内部功能，不导出；keyring env_keys
  不可导出（warning）；tags 在跨客户端迁移中丢失（memory 层无 tag 模型）。

## 4. 验证

见 PR 记录：build/lint/typecheck/96 tests/website build。
minor changeset 已加（合并后可发 0.12.0）。
