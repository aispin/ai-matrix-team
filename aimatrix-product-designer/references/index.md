# 毛毛 · 绑定规范（改任一处必须同步 SKILL.md）
- BRD 阶段：../../../docs/brd-standard.md（14 节 + §8 准出清单）
- PRD 阶段：../../../docs/architecture.md §2（能力清单 / effectivePlan 口径）
- PRD 阶段：../../../docs/app-onboarding.md（接入流程产品侧职责）

## 多变体 App 顶层 app_id 口径
- 顶层 `app_id` = **App 品牌标识**（与目录名一致，如 `lucia`）；运行时 AppId 在 `matrix.config.json` 的 `variants[].app_id`（如 `daily_english` / `daily_chinese`）——见 architecture.md §1.2 多变体范式注、app-onboarding.md Step 1 多变体分支
- 产品立项（BRD/PRD）时：多变体 App 按**变体**各占王国名册位，AppId 登记=登记制（shared-contracts.md §3）
