# GAP-ROUND-1 · 生产级对标（2026-08-05）

参照物（均为实际运行，非只读 README）：
1. **pandoc 2.9**（跨领域标杆：转换工具的错误处理/exit code/矩阵设计）
2. **claude / codex / gemini 官方 CLI**（`npm i -g` 真实安装，真实生成配置后与 agentmove 互操作实测）

## 实测记录（命令与输出）

- 干净环境 `npx -y agentmove-cli@latest --version` → `0.1.0`，一次成功 ✅
- pandoc：`pandoc -f nope -t html` → `Unknown input format nope`，**exit 21**；`pandoc missing.md` → **exit 1**。pandoc 对不同错误类型有[文档化的 exit code 契约](https://pandoc.org/MANUAL.html#exit-codes)。
- agentmove：所有错误一律 exit 1，无契约 ❌
- 真实互操作：`codex mcp add` / `claude mcp add --scope user` / `gemini mcp add -s user` 生成的真实配置，agentmove doctor 全部正确识别 ✅；`convert claude-code codex --apply` 写出的 config.toml 被 `codex mcp list` 正确加载（`docs2 … enabled`）✅
- **发现 P0 数据丢失风险**：convert 前 codex 已有 `docs` server，convert 后 config.toml 只剩导入的 `docs2` —— import 是 *replace* 语义而非 *merge*，目标端已有 MCP servers 被静默清掉（有备份，但违背「绝不静默丢数据」承诺）❌
- 坏输入：`.claude.json` 写入 `{ broken` 后 export → `error: Expected property name or '}' in JSON at position 2`——**没有文件路径上下文**，新用户无法定位 ❌；bundle 缺失报错良好（`/nonexistent: not an agentmove bundle (missing manifest.json)`）✅

## 差距清单

| # | 竞品做到了什么 | 我们现状 | 差距 | 优先级 |
|---|---|---|---|---|
| 1 | 官方 CLI `mcp add` 是增量添加，绝不动其它 server | import/convert 用 bundle 整体**替换**目标端 mcpServers | 目标端已有 server 被静默移除，违背诚实承诺 | **P0** |
| 2 | pandoc 报错永远带上下文（文件名/格式名） | 配置解析错误只有裸 parser 消息，无文件路径 | 用户无法定位坏文件 | **P0** |
| 3 | pandoc 有文档化 exit code 契约（1/3/4/21/…） | 一切错误 exit 1 | CI/脚本无法区分用法错误 vs 数据错误 | **P1** |
| 4 | 官方 CLI 输出迁移结果摘要 | `--apply` 只说 "wrote N file(s)" | 缺各层迁移计数摘要 | P2（下一轮） |
| 5 | pandoc `--list-*-formats` 机器可读 | doctor 只有人类可读输出 | 缺 `--json`（ROADMAP 已列） | P2（下一轮） |

## 覆盖率矩阵（真实环境实测：某层能否从 A 无损到 B）

行=source，列=target；✓=无损，≈=降级(带警告)，✗=不可（带警告），实测基于 fixtures + 真实 CLI 配置：

| 层 | →openclaw | →hermes | →claude-code | →codex | →cursor | →gemini |
|---|---|---|---|---|---|---|
| MCP servers | ✓ | ≈(headers/filters 丢弃有警告) | ✓ | ✓ | ≈(cwd 丢弃) | ✓ |
| instructions | ✓ | ✓ | ✓ | ✓ | ≈(.mdc rule) | ✓ |
| persona | ✓ | ✓ | ≈ | ≈ | ≈ | ≈ |
| memory | ✓ | ✓ | ≈ | ≈ | ✗ | ✓(Added Memories) |
| skills | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |

memory/skills 的 ✗/≈ 与 docs/limitations 页一致（诚实性核对通过）。

## 本轮修复（P0→P1）

1. **MCP merge 语义**（P0）：import/convert 默认与目标端已有 servers 合并；同名冲突以导入方为准并发警告；replace 需显式 `--replace-mcp`。
2. **解析错误带文件路径**（P0）：所有配置/manifest 解析错误包一层 `<path>: <message>`。
3. **exit code 契约**（P1）：0 成功；2 用法错误（未知客户端/参数）；3 输入数据错误（缺文件/坏格式）。写入 docs Commands 页。

## 回归结论（新用户视角，干净环境）

修复后重测：npx 一次成功；坏配置报错含路径可定位；convert 不再动目标端已有 servers。「实际体验能像 pandoc 一样优秀吗？」——错误处理与诚实性达标；仍不如之处：无 `--json`、无迁移摘要、Windows 未验证 → 列入 ROUND-2。
