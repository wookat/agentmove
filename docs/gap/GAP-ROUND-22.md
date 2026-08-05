# GAP-ROUND-22 — MIF v2 memory 互换（`--mif`）

日期：2026-08-05 · 参照物：MIF v2 规范（github.com/varun29ankuS/mif-spec）

## 1. 差距

roadmap 中期项「MIF / PAM import & export for the memory layer」未实现。
MIF v2 已按规范核实：JSON envelope，`mif_version` + `memories[]`，每条 memory
必填 `id`（UUID v4）/`content`/`created_at`（ISO 8601），其余可选；未知字段
round-trip 时应保留（我们的模型无法保留 → 如实 warning）。

## 2. 修复

- `export <client> --mif <file>`：memory 层额外写出 MIF v2 文档
  （source/kind 存入 `metadata`，daily 日期映射 `created_at`）。
- `import <client> --mif <file>`：从 MIF 文档导入 memory 层（替代 bundle），
  与 `--apply`/`--json`/merge 语义正交。
- 非 MIF 文件 → exit 3 带路径；embeddings/knowledge-graph 等无可移植槽位的
  字段丢弃并 warning。
- PAM（arXiv 论文级，BLAKE3+Ed25519 签名 Merkle-DAG）暂不实现：规范以加密
  验证为核心，超出无损配置迁移边界，roadmap 保留为开放项。

## 3. 验证

- 单测：round-trip、exit 3、缺 content 跳过 + 非可移植字段 warning。
- e2e：openclaw export --mif → gemini import --mif --apply（GEMINI.md 写入、
  条数一致）→ 坏文件 exit 3。
- 61 测试全绿；build/lint/typecheck 通过；minor changeset 已加。

## 4. 结论（诚实）

memory 层现在有厂商中立的交换格式出入口；MIF 的 embeddings/图数据不映射，
warning 如实报告。PAM 未实现，已在 roadmap 注明原因。
