# COMPARISON — 现有迁移工具与标准对比

> 采集日期：2026-08-04。每条结论附来源；「未验证」明确标注。

## 1. 竞品/相邻工具矩阵

| 工具 | 方向 | 覆盖内容 | dry-run | 备份 | diff | 中立性 | 来源 |
|------|------|----------|---------|------|------|--------|------|
| `hermes claw migrate` | OpenClaw→Hermes（单向） | persona、memory（含 daily 合并去重）、skills（4 来源）、模型/provider、MCP、行为设置、消息平台、TTS、密钥（需 `--migrate-secrets`） | ✅ `--dry-run`，且 apply 前强制预览 | ✅ pre-migration zip | ❌ | ❌ 只进 Hermes | [Hermes docs](https://hermes-agent.nousresearch.com/docs/guides/migrate-from-openclaw) |
| `hermes import-agent` | Claude Code / Codex → Hermes（单向） | 指令/skills 类（细节未展开） | 未验证 | 未验证 | ❌ | ❌ | 同上（提及） |
| `hermes setup` 自动检测 | 检测 `~/.openclaw` 引导迁移 | 同 claw migrate | — | — | — | ❌ | [mintlify 镜像](https://nousresearch-hermes-agent.mintlify.app/migration/openclaw) |
| agentgate config-convert | 6 客户端 MCP 配置互转（任意方向） | 仅 MCP servers 一层 | — | — | — | ✅ | wookat/agentgate（自研） |
| MIF 工具链（zircote/MIF） | memory 层互转（Mem0/Zep/Letta 等） | 仅 memory；JSON-LD+Markdown 双格式；**draft，无 provider 实现** | — | — | — | ✅ | [zircote/MIF](https://github.com/zircote/MIF)（SPECIFICATION.md 自述 "No providers currently implement MIF"） |
| PAM（portable-ai-memory.org） | memory 层 interchange | 仅 memory：11 类 memory types、provenance、confidence、relations、embeddings 伴随文件；v1.0 spec + JSON Schema | — | — | — | ✅ | [spec v1.0](https://portable-ai-memory.org/spec/v1.0/) |
| Portable Agent Memory（arXiv:2605.11032） | 学术协议 + Python SDK | memory 五分量模型（episodic/semantic/procedural/working/identity）、Merkle-DAG provenance | — | — | — | ✅ 学术 | [arXiv](https://arxiv.org/html/2605.11032) |
| 各客户端自带 | 无 export 命令 | Claude Code/Codex/Cursor/Gemini CLI 均无官方「导出到其它客户端」能力 | — | — | — | — | 各家官方文档核实 |

## 2. 结论（事实/推断区分）

- **事实**：市场上不存在任意方向、覆盖配置+MCP+skills+memory+persona 全量的中立迁移工具。最强的 `hermes claw migrate` 也是单向迁入。
- **事实**：SKILL.md（frontmatter `name`/`description` + Markdown 正文）已成跨客户端事实标准：Codex（`~/.agents/skills`、repo `.agents/skills`）、Claude Code（`.claude/skills`）、OpenClaw（workspace/skills 等 4 处）、Hermes（`~/.hermes/skills`）结构一致 → skills 层可近似无损迁移。
- **事实**：MCP 配置层各家同构（name→command/args/env 或 url/headers），agentgate 已验证互转可行。
- **推断（置信度高）**：最难的一层是 memory——格式从自由 Markdown（OpenClaw MEMORY.md/daily files）到结构化条目（Hermes `§` 分隔）到 GEMINI.md 附记不等；采用「原文保真 + 结构化条目（PAM 兼容）双轨」可同时满足无损与互操作。
- **推断（置信度中）**：MIF/PAM 短期不会被厂商原生采纳（MIF 自述无实现），AgentMove 以 bundle 内嵌 PAM 兼容 memory.json 即可蹭标准红利、不押注单一标准。

## 3. 差异化定价/定位

开源（MIT）、免费 CLI；与 agentgate 组成「agent 基建工具族」。竞品均为厂商附属功能，中立性即护城河。
