# GAP-ROUND-6 · 生产级对标（2026-08-05）

参照物（实际运行）：**codex `completion fish`**（官方 CLI 覆盖 bash/zsh/fish 三 shell）。

## 差距清单

| # | 竞品做到了什么 | 我们现状（ROUND-5 后） | 差距 | 优先级 |
|---|---|---|---|---|
| 1 | codex completion 覆盖 fish | 仅 bash/zsh | fish 用户无补全 | P2 |
| 2 | 生产级 CLI `--version` 与发布版本一致 | `.version("0.1.0")` 硬编码，changesets 升版后必然漂移 | 版本谎报风险（潜伏 bug） | **P1** |

## 本轮修复

1. `agentmove completion fish`：真实 fish 中验证 `complete -C"agentmove convert ge"` → `gemini`。
2. `--version` 改为运行时读取 package.json 的 version；e2e 断言 `--version` 输出与 package.json 一致，防止发布漂移。

## 回归结论

completion 三 shell 对齐 codex；版本漂移隐患在首次升版前被消除。剩余候选：man page、npm provenance（需 org 配置）。
