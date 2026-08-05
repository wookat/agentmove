# GAP-ROUND-26 — 第 10 客户端：OpenHands

日期：2026-08-04 · 参照物：OpenHands 官方文档（docs.openhands.dev mcp-settings）+ OpenHands/OpenHands 仓库 config.template.toml、skills/README.md

## 0. 前置：v0.6.0 发布与干净环境回归

- v0.6.0 Release 已建：https://github.com/wookat/agentmove/releases/tag/v0.6.0
- `npx agentmove-cli@0.6.0` 干净环境回归通过（重点 Zed）：
  - doctor 识别 Zed（1 server + instructions）；
  - export 默认脱敏 Authorization → `${Authorization}`；
  - openclaw→zed convert：无 args 的 stdio server 落盘时补 `args: []`（Zed schema 硬性要求）；
  - 坏 bundle 输入单行报错。

## 1. OpenHands 格式核实（证据）

- MCP：`~/.openhands/config.toml` `[mcp]` 段，按 transport 分三个列表：
  - `stdio_servers`：{name, command, args, env}（官方标注 development only，推荐 MCP proxy）；
  - `shttp_servers`（推荐）与 `sse_servers`（legacy）：字符串 URL 或 {url, api_key, timeout(1-3600s)}。
  - CLI 曾以 array-of-tables（`[[mcp.stdio_servers]]`）落盘（OpenHands#10173），
    TOML 解析后与 inline 数组同构，两种形态都能读。
- 远程认证仅支持 `api_key`（映射 Bearer Authorization），任意 header 不支持——非 Bearer header 丢弃 + warning。
- 指令：用户级 microagents `~/.openhands/microagents/*.md`（OpenHands#9325 起）；
  项目级 `.openhands/microagents/repo.md`。
- Skills：仓库级 `.openhands/skills/`（V1，SKILL.md 目录，与跨客户端事实标准一致）；
  无用户级 skills 目录。

## 2. 实现

- 用户级 adapter `openhands`：三列表导入导出（stdio 按 name 合并、远程按 url 去重合并、
  `--replace-mcp` 全量替换）、microagents 拼接为 instructions、
  导入写 `microagents/agentmove-imported.md`；timeout/多余 header/enabled 均 warning。
- 项目级 adapter：`.openhands/microagents` + `.openhands/skills`（skills 首个支持项目级 skills 的目标）。
- 全矩阵 e2e 扩至 10×10（90 方向）+ 全目标 round-trip。

## 3. 验证

- 74 测试全绿；coverage 83.54 lines / 67.18 branches（门禁 80/65）；
  build/lint/typecheck/website build 通过；README/官网/man 同步；minor changeset（下次发版 0.7.0）。

## 4. 结论（诚实）

OpenHands 的 api_key-only 远程认证与 timeout 不可移植为真实边界，均 warning 呈现；
conversation state 属 app 管理不迁移。
