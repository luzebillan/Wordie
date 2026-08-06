# 04 — 模糊匹配与查重功能

**What to build:** 
在保存新卡片前，系统从已有数据库中查找到至多 3 个“语义匹配”的相似表达，并在页面下方以卡片形式展示它们的正面、反面以及当前已复习次数。

**Blocked by:** 01 — Useful Expressions 基础 UI 框架

**Status:** ready-for-agent

- [ ] 结合本地应用特性（放弃笨重的 ChromaDB），在 IPC 的 `searchCards` 方法基础上，实现基于当前 Context 和 Front/Back 内容的本地 TF-IDF 或轻量级模糊匹配逻辑。
- [ ] 前端接收至多 3 条匹配记录，渲染卡片，展示已复习次数。
- [ ] 确保搜索能够过滤出属于 `useful_expression` 类别的卡片，逻辑与脚注3的要求（匹配“已有数据库中寻找语义相近表达”）在效果上保持一致。
