# GAP-ROUND-9 · 0.1.1 干净环境全链路回归（2026-08-05）

方式：干净目录 `npx -y agentmove-cli@0.1.1` 实测全部命令。

## 回归结果

| 项 | 结果 |
|---|---|
| `--version` | 0.1.1（动态版本修复生效） |
| `clients` / `doctor --json` / `export --json` / `diff --json` | 通过 |
| `convert --apply` + 迁移摘要 + 备份 | 通过 |
| `completion bash/fish` | 通过 |
| 只读目录 EACCES：指引 + `--debug`/`AGENTMOVE_DEBUG=1` stack | 通过 |
| `npm i -g` 后 `man agentmove` | **失败：man page 未被 npm 软链** |

## 发现的缺陷（P1）

npm 只软链 basename 与包名一致的 man 文件，且（npm 11 实测）仅当 `man` 字段为数组时才链接（最小复现：`"man":["./man/agentmove-cli.1"]` 会被链入 `<prefix>/share/man/man1/`；字符串形式或 `agentmove.1` 均不会）。0.1.1 的 `"man": "./man/agentmove.1"` 因此从未生效。

## 本轮修复

man page 重命名为 `man/agentmove-cli.1`，package.json `man` 字段改为数组形式；全局安装实测 `man agentmove-cli` 可用；文档补充说明；e2e 断言更新并注明原因。

## 结论

0.1.1 其余能力全部通过干净环境回归；man 链接缺陷已修复待发 0.1.2。
