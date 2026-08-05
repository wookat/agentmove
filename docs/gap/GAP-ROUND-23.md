# GAP-ROUND-23 — 无关层导入不再重写目标 MCP/config 文件

日期：2026-08-05 · 参照物：0.4.0 干净环境回归（Windsurf + `--mif`）

## 1. 差距

0.4.0 干净环境回归全部通过（Windsurf doctor/convert、serverUrl 归一化、
Authorization 脱敏、MIF round-trip、坏文件 exit 3）。但发现 P2 打磨点：
`import gemini --mif memories.mif.json` 这类**不含 MCP 层**的导入，dry-run
计划里仍包含目标端 MCP/config 文件——内容等价但会被无谓重写（重排序/
重新序列化、触发无意义备份，openclaw 的 JSON5 注释还会因此丢失）。

## 2. 修复

新增 shared `touchesMcpConfig()`：当导入 0 个 MCP server、无 `--replace-mcp`、
且无 model 变更（codex/hermes/openclaw 的 config 兼载 model）时，7 个用户级
adapter 与 4 个项目级 adapter 均不再输出 MCP/config 文件计划。

## 3. 验证

- 新 e2e：`--only memory` 导入后 `.gemini/settings.json` 字节级不变、
  不出现在 files 计划中。
- 62 测试全绿（既有 merge/replace 行为不受影响）；build/lint/typecheck 通过。

## 4. 结论（诚实）

最小侵入原则补齐到「不写就是不碰」；patch changeset 已加。
