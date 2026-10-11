# 索引卡 · 04 决策协议（DR）
读正文时机：遇到不可逆/凭据/选型/冲突/缺事实/红线时。
- §1 三概念（DR/ADR/待办清单）不混。§2 六类触发（D1-D6）命中必落 DR。
- **新机制（SPEC-20261010-03）**：`guard dr add` 落 `<project>/.ai-matrix-team/decisions.md` **h2 条目块**（方案 ≤3 有序列表、推荐写序号）；**用户唯一动作 = 改「回填」行**（`ZEO 10-11 选2`，谁+日期+结论）。`dr scan` 同时扫旧 open/ 目录与新条目块。闭环 `archive move --kind dr` 归档。
- §3 字段规范（模板 templates/dr.md）。§4 状态机（OPEN/ANSWERED/DEFERRED/EXPIRED/WITHDRAWN）。
- §5 落盘命名（DR-YYYYMMDD-NNN，open/closed）。§6 人类答复三通道。§7 防 OPEN-ITEMS 漂移。§8 度量。
