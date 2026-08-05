# GAP-ROUND-11 · 维持性小轮：文档与发布状态同步（2026-08-05）

方式：以新用户视角复读 README 与官网 quick-start，对照 0.1.2 实际能力。

## 发现并修复

| # | 问题 | 修复 |
|---|---|---|
| 1 | README/官网仍留「Until the package is published on npm…」过时提示（0.1.2 已发布） | 删除；官网 quick-start 改为 completion/man 使用提示 |
| 2 | README Commands 节重复两段 `--json` 说明（ROUND-3 合并遗留） | 合并为一段，并补 completion/man/--debug |

## 竞品动向复测

npm 实测：`agentmove-cli@0.1.2` 已发布可用；hermes-agent 现为 0.19.0（其 `claw migrate` 仍为单向迁入，无新的能力面变化影响本项目定位）。

## 结论

文档与 0.1.2 实际能力一致；无新 P0/P1。
