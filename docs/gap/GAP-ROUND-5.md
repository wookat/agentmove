# GAP-ROUND-5 · 生产级对标（2026-08-05）

参照物：pandoc / codex 等生产级 CLI 均提供 macOS + Windows 官方支持与 CI 证据。

## 差距清单

| # | 竞品做到了什么 | 我们现状（ROUND-4 后） | 差距 | 优先级 |
|---|---|---|---|---|
| 1 | 跨平台支持有 CI 证据 | 仅 ubuntu CI；Windows/macOS 从未跑过 | 兼容性口说无凭 | **P1** |

## 本轮修复

CI 新增 `os-matrix` job：macos-latest + windows-latest 全量跑 `pnpm build && test`（35 项含子进程 e2e）。
Windows 上 chmod 不生效，EACCES e2e 用 `it.skipIf(win32)` 如实跳过（其余 34 项照跑）。

## 回归结论

以本 PR 的 CI 运行结果为准：绿则 macOS/Windows 兼容性首次有证据；若红则按平台差异修复后再合并（不降低测试标准）。
