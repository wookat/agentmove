# GAP-ROUND-7 · 生产级对标（2026-08-05）

参照物（实际验证）：**pandoc** —— `man pandoc` 可用，npm/deb 均随包发行 man page。

## 差距清单

| # | 竞品做到了什么 | 我们现状（ROUND-6 后） | 差距 | 优先级 |
|---|---|---|---|---|
| 1 | pandoc 随包发行 man page，`man pandoc` 可查 | 无 man page | Unix 用户离线查阅缺失 | P2 |

## 本轮修复

新增 `man/agentmove.1`（roff），覆盖全部 7 个命令、全局选项、exit status、FILES；package.json 加 `"man"` 字段并入 `files`（npm/pnpm 全局安装时自动软链到 man path）。
实测：`man ./man/agentmove.1` 渲染正常（无 groff 警告）；`npm pack --dry-run` 含 `man/agentmove.1`（2.3 kB）。
e2e 断言 man page 存在、被 package.json 引用、覆盖全部命令名（防新命令漏文档）。

## 回归结论

离线文档（--help、man、completion）已对齐 pandoc 水准。剩余候选：npm provenance / trusted publishing（需 npm org 侧配置，属外部资源）。
