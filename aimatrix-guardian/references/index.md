# 丹丹 · 绑定规范（改任一处必须同步 SKILL.md）
- ../../../docs/spec-shared-contracts.md（共享面清单 + 协作纪律；变更历史以 commit 带 WO 号 + WO 详情单为准）
- ../../../matrix.config.schema.json（配置 schema）
- ../../docs/03-shared-surface-control.md（面域/权限/锁/登记全文）

## 多变体 App 顶层 app_id 口径
- `matrix.config.json` 顶层 `app_id` = **App 品牌标识**（与目录名一致）；单变体 App 即运行时 AppId，多变体 App 的运行时 AppId 在 `variants[].app_id`
- `AppId` 契约 = **登记制**：新增成员须改 spec-shared-contracts.md 契约清单（§1）并当日收口 commit（带 WO 号），**禁改名/删除已有成员**；审查 schema/app_id 相关改动时按此口径核对
