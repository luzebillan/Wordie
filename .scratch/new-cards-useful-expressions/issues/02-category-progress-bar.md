# 02 — 分类进度条实现

**What to build:** 
在 Useful Expressions 界面顶部实现专属的复习进度条（深色表示已复习，浅色表示未复习）。
这需要底层数据库查询接口支持按 `type` 统计数据。

**Blocked by:** 01 — Useful Expressions 基础 UI 框架

**Status:** ready-for-agent

- [ ] 在 `global.d.ts` 和 IPC 层（`main/db.ts`）新增或修改方法，例如 `getStatsByType('useful_expression')`。
- [ ] 查询逻辑需返回该类别下今天已经复习的数量，以及未复习（今天 Due）的数量。
- [ ] 在 UI 顶部渲染进度条，按深浅色准确反映比例。
