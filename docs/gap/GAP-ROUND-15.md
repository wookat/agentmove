# GAP-ROUND-15 — 真实场景差距：同目录重复 export 残留旧层文件（P1）

日期：2026-08-05 · 参照物：真实用户工作流（bundle 目录进 git / 反复导出）

## 1. 发现（built CLI 实测）

```console
$ agentmove --home $H export openclaw -o b
exported 2 MCP server(s), 1 skill(s), 3 memory entr(ies), instructions, persona to b
$ agentmove --home $H export openclaw -o b --only mcp
exported 2 MCP server(s), 0 skill(s), 0 memory entr(ies) to b
$ ls b
config.json instructions.md manifest.json mcp-servers.json memory persona.md skills
#           ^^^^^^^^^^^^^^^ 残留                                  ^^^^^^^^^^ 残留
```

摘要说 0 skills，但目录里仍有上一次导出的 instructions.md / persona.md /
skills/ / memory 原文 —— 后续 `import` 这个 bundle 会把用户明确用 `--only`
排除的层照样迁走（memory/memory.json 虽被覆盖为 []，md 层残留照迁）。
bundle 常被提交进 git，残留还会把不想共享的层带进仓库。**P1 数据完整性。**

## 2. 修复

`writeBundle` 写入前先删除 bundle 自有的文件/目录（manifest.json、config.json、
mcp-servers.json、instructions.md、persona.md、memory/、skills/）；
非 bundle 自有文件（如用户放的 NOTES.txt）不动。e2e 覆盖：重复导出后无残留、
用户文件保留。patch changeset 已加。

## 3. 回归结论（诚实）

修复后 export 语义变为「输出目录内 bundle 部分 = 本次导出的精确快照」，与
pandoc 输出文件整体覆盖的直觉一致。未发现其它新缺陷。
