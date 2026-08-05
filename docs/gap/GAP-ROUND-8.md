# GAP-ROUND-8 · 生产级对标（2026-08-05）

参照物：npm（`--loglevel verbose` + 错误默认单行、指引重跑）、docs/MATURITY.md A5 中遗留的 `--debug` 诊断项。

## 差距清单

| # | 竞品做到了什么 | 我们现状（ROUND-7 后） | 差距 | 优先级 |
|---|---|---|---|---|
| 1 | 生产级 CLI 意外错误默认单行 + 可选诊断模式 | 意外错误单行但无法拿到 stack，排障只能改代码 | 用户报 bug 时无诊断信息可提供 | **P1** |

## 本轮修复

全局 `--debug`（或 `AGENTMOVE_DEBUG=1`）：意外错误（exit 1）打印完整 stack；默认输出追加一行 `(rerun with --debug or AGENTMOVE_DEBUG=1 for a stack trace)` 指引。CliError（exit 2/3，用户可自行修复）不提示。
实测：只读 home 下 `convert --apply` 默认单行+指引；`--debug` 输出完整 stack（e2e 断言）。

## 回归结论

MATURITY A5 健壮性项至此全部完成。剩余候选仅 npm provenance（外部资源）。
