# BRD / PRD 交付细则（aimatrix-product-designer 参考）

本文件承载 [`../SKILL.md`](../SKILL.md) 阶段一、阶段二的完整细则与坑位表。写 BRD/PRD 时读。

## 1. 阶段一 · BRD（产出 `apps/<app>/docs/<App>_BRD_v1.0_CN.md`）

1. 新闻稿（含具体假想发布日）
2. FAQ（≥10 条，≥3 条最难题）
3. Job Story（每条带可观测 AC）
4. 分层与 unit economics
5. 北极星 + Go/No-Go 底线值
6. Type 1/2 决策清单
7. 共享面影响初判（`guard surface`）
8. **过准出清单**（`docs/brd-standard.md` §8，全过才许开 PRD）

## 2. 阶段二 · PRD（产出 `<App>_PRD_vX.Y_CN.md` + 验收清单）

1. 从 BRD **引用**结论（写章节号，禁止复制粘贴）
2. 功能地图
3. 逐条 AC（禁止「体验流畅」这类不可观测表述）
4. NFR（性能/离线/隐私）
5. 埋点（走 `services/telemetry`）
6. 标注哪些能力依赖 `effectivePlan`

## 3. 坑位表

| 症状 | 根因 | 修法 |
|---|---|---|
| 前端直取内部权益字段 | PRD 没写清权益消费口径 | PRD 一律标 `effectivePlan`；红线见架构文档 §2 |
| BRD 写成功能列表 | 跳过新闻稿/FAQ | 按 14 节顺序，§8 准出清单逐项勾 |
| 存量 App 文档格式不一 | 旧文档先于规范 | **不为对齐而重写**，大修时才按规范重排 |
| 深色下白块穿帮 | SVG/样式硬编码颜色 | 全部走 `var(--n-*)` / `currentColor`；交付前切深色自查 |
| 稿子好看但实现走样 | 交了图片没交结构 | 必交单文件 HTML（可点击），实现直接对照 DOM 与变量 |
| 两个闸门被跳过 | 需求不明就开画 | 需求摘要没确认 → 停；状态矩阵没列全 → 停 |
| 图标 16px 糊成一团 | 24px 直接缩小 | 16px 版本单独重画，只留 2-3 条线 |
