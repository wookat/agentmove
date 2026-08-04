# V2EX 草稿（勿外发）

**标题**：做了个 AI Agent 搬家工具 AgentMove：在 Claude Code / Codex / Cursor / Gemini CLI / OpenClaw / Hermes 之间任意方向迁移记忆、技能、MCP、人设

**正文**：

Hermes 靠一键从 OpenClaw 搬家半年拿了 21 万 star，说明「搬家」是刚需，但现有工具全是单向搬入某家。AgentMove 是中立版：纯本地 CLI，任意方向迁移 配置 + MCP servers + skills + memory + persona。

    npx agentmove-cli doctor
    npx agentmove-cli convert claude-code codex        # 默认 dry-run
    npx agentmove-cli convert claude-code codex --apply  # 写盘前自动备份

特点：默认 dry-run；疑似密钥自动脱敏成 ${VAR} 占位符；迁不过去的部分（比如 Cursor 的 app 内记忆）会明确警告，绝不静默丢数据；中间格式是纯文本 bundle，可以进 git。

文档 https://agentmove.zalize.com · 源码 https://github.com/wookat/agentmove （Apache-2.0），欢迎提新客户端 adapter。
