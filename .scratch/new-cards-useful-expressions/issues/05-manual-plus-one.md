# 05 — 专属“+1”按钮（只加次数，不加间隔）

**What to build:** 
在查重出来的已有卡片下方，提供一个“+1”按钮。用户点击后，针对那张已有卡片的复习次数+1，但**绝不影响复习算法（SRS）计算的复习间隔**。

**Blocked by:** 04 — 模糊匹配与查重功能

**Status:** ready-for-agent

- [ ] 扩展现有的 `cards` 表，新增 `manualReviewCount` 字段（或其他命名）以独立记录此类非正式的点击次数，避免污染真实的 SRS 数据。
- [ ] 在 `db.ts` 新增 IPC 接口 `incrementManualReviewCount(id)`。
- [ ] 在 UI 上，展示的“已复习次数”应包含该字段，并在点击“+1”后即时更新展示。
