# GAP-ROUND-4 · 生产级对标（2026-08-05）

参照物（实际运行）：
1. **codex `completion bash`**：官方 CLI 自带 shell completion 生成。
2. **pandoc `--bash-completion`**：`eval "$(pandoc --bash-completion)"` 启用模式。

## 差距清单

| # | 竞品做到了什么 | 我们现状（ROUND-3 后） | 差距 | 优先级 |
|---|---|---|---|---|
| 1 | codex/pandoc 均可生成 completion 脚本 | 无 completion | 命令/客户端 id/flag 全靠手打 | **P1** |
| 2 | man page（pandoc） | 无 | 次要（--help/docs 站覆盖） | P2（暂缓） |
| 3 | Windows 官方实测 | 未实测（纯 Node/fs 代码，理论兼容） | 无 Windows 证据 | P2（本环境无 Windows，如实标注） |

## 本轮修复

新增 `agentmove completion <bash|zsh>`：补全命令名、client id（export/import/convert/diff 的位置参数）、各命令 flag；未知 shell exit 2。
真实验证：在真实 bash 中 source 后 `convert ge<TAB>` → `gemini`、`import codex --re<TAB>` → `--replace-mcp`（已入 e2e）。

## 回归结论（新用户视角）

completion 体验与 codex/pandoc 同级（bash/zsh；fish 未做）。仍落后项：man page、Windows 实测证据 → 后续轮候选（Windows 需要外部环境）。
