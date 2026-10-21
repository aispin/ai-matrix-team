# 毛毛 · 绑定规范（改任一处必须同步 SKILL.md）
- BRD 阶段：项目 BRD 规范（`project.json.docs.brd` 绑定，示例命名 `docs/spec-brd.md`；14 节 + §8 准出清单）
- PRD 阶段：项目 PRD 规范 §2 能力清单 / effectivePlan 口径（`project.json.docs.prdStandard` 绑定，示例命名 `docs/03.tdd-arch.md`）
- PRD 阶段：项目接入 SOP（`project.json.docs.appOnboarding` 绑定；接入流程产品侧职责）
- 图示（四种范式 · 风格硬约束 · 反模式 · 何时不画图）：diagrams.md

## 多变体 App 顶层 app_id 口径
- 顶层 `app_id` = **App 品牌标识**（与目录名一致，如 `lucia`）；运行时 AppId 在 `matrix.config.json` 的 `variants[].app_id`（如 `daily_english` / `daily_chinese`）——见项目 PRD 规范的多变体范式注、项目接入 SOP 的多变体分支
- 产品立项（BRD/PRD）时：多变体 App 按**变体**各占王国名册位，AppId 登记=登记制（spec-shared-contracts.md §3）
