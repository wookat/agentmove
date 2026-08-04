# AgentMove — 项目提案（PROPOSAL）

> 状态：已按 CHARTER「提议即默认方案」原则生效——如无异议按此执行。调研日期：2026-08-04。

## 一句话定位

**AgentMove 是 agent 世界的 pandoc**：在 OpenClaw / Hermes Agent / Claude Code / Codex / Cursor / Gemini CLI 之间**任意方向**迁移「配置 + MCP servers + skills + memory + persona/instructions」，可 dry-run、可 diff、无损优先/有损降级并逐项报告。开源、中立、本地运行、不上传任何数据。

## 为什么现在做（痛点验证，置信度：高）

1. **搬家已被证明是杀手级功能**：Hermes Agent 的 `hermes claw migrate` 一键从 OpenClaw 迁入 persona/memory/skills/配置/密钥，是其增长核心卖点之一（官方文档有完整迁移矩阵，来源：hermes-agent.nousresearch.com/docs/guides/migrate-from-openclaw）。
2. **但所有现存工具都是单向迁入（吸血式）**：`hermes claw migrate`（OpenClaw→Hermes）、`hermes import-agent`（Claude Code/Codex→Hermes）均只进不出；各客户端没有 export。用户被锁在目的地。**没有任何中立的、任意方向的迁移工具**（来源：逐一核实各家文档，见 COMPARISON.md）。
3. **标准碎片化且无实现**：MIF（zircote/MIF，JSON-LD+Markdown 双格式，draft、无 provider 实现）、PAM（portable-ai-memory.org，v1.0 JSON interchange，面向 memory 单层）、arXiv 2605.11032（学术协议）。都只覆盖 memory 一层，不覆盖配置/MCP/skills/persona 的整体搬家。
4. **配置层高度相似、技术可行性已验证**：我们在 agentgate/packages/config-convert 已实现 6 客户端 MCP 配置无损/降级互转（canonical model + adapter + warnings 模式），代码模式可直接复用。

## 方案

### 核心概念：AgentMove Bundle（`.agentmove/` 目录或 tarball）

中间表示（IR），任意 adapter 均可读写：

```
bundle/
  manifest.json          # 版本、来源客户端、导出时间、内容清单
  config.json            # 规范化配置（model、行为设置；保留 raw 供无损回放）
  mcp-servers.json       # 规范化 MCP server 列表（复用 agentgate canonical model）
  instructions.md        # AGENTS.md/CLAUDE.md/GEMINI.md 类全局指令
  persona.md             # SOUL.md 类人格文件
  memory/                # 记忆条目（MIF/PAM 兼容的 JSON + 原始 Markdown）
    memory.json
    raw/*.md
  skills/<name>/SKILL.md # skills（SKILL.md 已是事实标准，各家通用）
```

### CLI（npm 包名 `agentmove-cli`，命令名仍为 `agentmove`；裸名 `agentmove` 因 npm 去连字符判重与 `agent-move` 冲突被 403 拒绝）

```
agentmove export <client> [-o bundle]     # 客户端 → bundle
agentmove import <client> [-i bundle]     # bundle → 客户端（默认 dry-run 预览，--apply 落盘，自动备份）
agentmove convert <from> <to>             # 直连迁移 = export + import
agentmove diff <from> <to>                # 两客户端（或 bundle 与客户端）差异
agentmove doctor                          # 检测本机已装客户端、配置健康度、可迁移内容盘点
```

### 原则

- **无损优先，有损降级并逐项报告**：每个 adapter 返回 warnings（沿用 agentgate 模式）；不支持的字段明确说明去向（dropped/kept-verbatim/approximated）。
- **默认安全**：import 默认 dry-run；apply 前自动 zip 备份目标目录（对齐 hermes 的 pre-migration backup 体验）；**默认不迁移密钥**，`--include-secrets` 显式开启。
- **插件式 adapter**：`ClientAdapter { id, detect(), export(), import(), paths }`，新客户端只需加一个 adapter 文件。

### 技术栈

TypeScript + Node ≥22 + pnpm workspace + vitest + eslint（typescript-eslint）+ GitHub Actions CI；文档站 Astro Starlight + Cloudflare Pages。全部对齐 agentgate 工程标准。

## 里程碑

| # | 交付 | 验收 |
|---|------|------|
| M1 | 调研三件套（本文档 + COMPARISON + FORMAT-MATRIX） | PR 合入 |
| M2 | 脚手架 + CI + core（bundle 模型/diff 引擎） | CI 绿，vitest 通过 |
| M3 | 6 客户端 adapter + 5 个 CLI 命令 + 测试 fixtures | 每对方向 convert 均有测试；README quick start 真实可运行 |
| M4 | 文档站上线 pages.dev | 可访问 |
| M5 | npm 发布 v0.1（待 NPM_TOKEN） | `npx agentmove-cli doctor` 可用 |

## 范围与非目标

- **做**：上表 6 客户端的本地文件级迁移；MIF/PAM 的 memory 导出兼容。
- **不做（v0）**：云端账户数据迁移（如 ChatGPT 云 memory）、会话历史转录迁移、GUI。

## 风险

- 各客户端格式演进快（OpenClaw 的 workspace 目录已改名过一次）→ adapter 内多路径探测 + doctor 报告版本；fixtures 锁行为。
- 名称：`agentmove` npm 可用、github wookat/agentmove 可用；品牌上够直白，暂不改名（调研中未发现更优且未被占用的名字，`agentport` 已被占）。

## 外部资源（一次性识别，已按 CHARTER §3.7 汇报申请，不阻塞）

1. 创建 wookat/agentmove 仓库并授权 Devin GitHub App（硬依赖，等待期间本地推进）。
2. NPM_TOKEN（发布/占名）。
3. 正式域名（docs 先用 pages.dev）。
