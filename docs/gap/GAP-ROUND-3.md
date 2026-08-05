# GAP-ROUND-3 · 生产级对标（2026-08-05）

参照物（实际运行）：
1. **pandoc `--list-input-formats` / `--list-output-formats`**：可发现的能力矩阵。
2. **只读目录实测**：`chmod -w` 后跑 `convert --apply`，观察错误体验。

## 差距清单

| # | 竞品做到了什么 | 我们现状（ROUND-2 后） | 差距 | 优先级 |
|---|---|---|---|---|
| 1 | pandoc 可枚举全部输入/输出格式 | 客户端列表只藏在 help 文本里 | 脚本无法发现支持的客户端 | **P1** |
| 2 | ROUND-2 给了 import/convert/diff/doctor `--json`，export 没有 | `export --json` 报 unknown option | 输出接口不一致 | **P1** |
| 3 | 生产级 CLI 权限错误给补救指引 | 实测只读 home：`error: EACCES: permission denied, mkdir …`（干净但无指引） | 缺补救提示 | **P2** |

## 本轮修复

1. 新增 `agentmove clients [--json]`：枚举 id/label/默认路径（pandoc `--list-input-formats` 对标）。
2. `export --json`：输出 `{ out, summary, warnings }`，与其余命令一致。
3. EACCES/EPERM 错误追加 `(check file/directory permissions, or rerun with a writable --home)` 指引；e2e 验证 exit 1 且无堆栈。

## 回归结论（新用户视角）

只读 home 实测报错含指引且无堆栈；`agentmove clients --json` 可被脚本消费；六个命令 `--json` 全覆盖。相比 pandoc 仍缺：shell completion、man page、Windows 实测 → ROUND-4 候选。
