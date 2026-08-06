# 03 — 接入 AI 释义生成

**What to build:** 
当用户在 Back Side 点击“生成释义”时，调用 AI API，根据用户在 Context 框和 Front Side 框输入的内容生成简明释义。

**Blocked by:** 01 — Useful Expressions 基础 UI 框架

**Status:** ready-for-agent

- [ ] 在 IPC 层新增/更新 `generateExpression(context, style, front)` 接口。
- [ ] 严格使用文档脚注2中的 Prompt 进行调用：
  `Task: Provide a concise English definition for "{front}" based on context: "{context}". STRICT RULE: Do NOT use the word "{front}" in the definition and DO NOT provide detailed explanation of how the word means inside the context.`
- [ ] 将 API 返回的解释结果填充到 Back Side 文本框中，支持用户再次手动编辑。
