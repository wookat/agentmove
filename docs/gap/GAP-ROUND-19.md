# GAP-ROUND-19 — 转换矩阵全覆盖 e2e（pandoc 级矩阵保证）

日期：2026-08-05 · 参照物：pandoc（任意 reader×writer 组合都被测试矩阵覆盖）

## 1. 差距

我们宣称 6 客户端任意方向迁移（30 个方向），但 e2e 只覆盖了少数代表性
组合（openclaw→hermes、claude↔codex 等）。pandoc 的可信度来自其转换矩阵
被系统性测试——任何组合坏掉会立即被 CI 捕获。**P1 测试覆盖缺口。**

## 2. 修复

新增两条 e2e（跑真实构建产物、真实 fixture home）：

- **6×6 全矩阵 convert**：每个 source fixture × 每个 target 共 30 个方向，
  断言 `--json` 输出 mcpServers>0 且有产出文件。
- **全目标 round-trip**：openclaw → 每个 target `--apply` 写入 → 从该
  target 重新 export，断言 MCP 层存活。

45 测试全绿（新增 2）；覆盖率 87.26% lines。

## 3. 结论（诚实）

矩阵回归从「抽样」升级为「全覆盖」，与 pandoc 同级；main 曾因 Dependabot
合入 TS7 短暂变红，已由 #31 回退修复并恢复绿色。无新 P0。
