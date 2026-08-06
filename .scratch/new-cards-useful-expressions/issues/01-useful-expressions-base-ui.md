# 01 — Useful Expressions 基础 UI 框架

**What to build:** 
搭建 New Cards 模块中 "Useful Expressions" 的基础 React 组件与交互结构，严格匹配 PPT 设计。
用户可以在该界面看到：
1. 顶部的分类专属进度条（占位）。
2. Context 输入框，以及下方三个单选框（Informal, Formal, General）。其中 General = both informal and formal。
3. Front Side 卡片正面输入框（用户输入词汇）。
4. Back Side 卡片背面（展示 AI 生成的释义），包含“生成释义”按钮和“Save”按钮。
5. 下方的语义查重结果区域（占位）。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 按照 PPT 样式还原所有的输入框、单选框及按钮样式。
- [ ] 所有的文案和图标需与 PPT 中的“New Cards 功能 1: Useful Expressions”保持一致。
- [ ] 绑定基础的 React state 以存储用户的输入内容。
