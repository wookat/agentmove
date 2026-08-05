# GAP-ROUND-25 — 第 9 客户端：Zed

日期：2026-08-04 · 参照物：Zed 官方文档（zed.dev/docs/ai/mcp、/ai/instructions）+ zed-industries/zed PR/issue

## 0. 前置：v0.5.0 发布与干净环境回归

- v0.5.0 Release 已建：https://github.com/wookat/agentmove/releases/tag/v0.5.0
- `npx agentmove-cli@0.5.0` 干净环境回归通过：
  - doctor 识别 Cline（2 servers + instructions）；
  - cline→windsurf convert：streamableHttp→serverUrl，Authorization 默认脱敏 `${Authorization}`；
  - no-op MCP write 修复实测：memory-only import 前后 `cline_mcp_settings.json` md5 相同。

## 1. Zed 格式核实（证据）

- MCP：`~/.config/zed/settings.json` 的 `context_servers` 键（非 mcpServers）。
  本地：`command`/`args`/`env`（zed#33539 起为扁平标准格式）；远程：`url` + `headers`
  （省略 Authorization 时走 OAuth）。支持 stdio 与 Streamable HTTP。
- 注意：Zed schema 要求 stdio server 必须带 `args`，缺失会静默加载失败
  （zed#59615）——导入时对无 args 的 stdio server 强制补 `args: []`。
- settings.json 为 JSONC（允许注释）——用 JSON5 解析；重写不保留注释，warning 如实说明。
- 指令：个人 `~/.config/zed/AGENTS.md`（zed#56757 起）；项目级首个匹配
  `.rules`/`.cursorrules`/`.clinerules`/`AGENTS.md`/`CLAUDE.md`/… 列表。
- Rules Library / Skills 为 app 管理，不迁移。

## 2. 实现

- 用户级 adapter `zed`：context_servers 导入导出（合并语义、无关 settings 键保留、
  stdio 强制 args、disabled 无对应字段 warning）、AGENTS.md 为 instructions；
  persona 近似、memory/skills warning。
- 项目级 adapter：`.zed/settings.json`（context_servers）+ `.rules`。
- 全矩阵 e2e 扩至 9×9（72 方向）+ 全目标 round-trip。

## 3. 验证

- 70 测试全绿；coverage 83.98 lines / 67.22 branches（门禁 80/65）；
  build/lint/typecheck/website build 通过；README/官网/man 同步；minor changeset（下次发版 0.6.0）。

## 4. 结论（诚实）

Zed 的 JSONC 注释不保留与 Rules Library 不可迁移为已知损失，均以 warning 呈现。
