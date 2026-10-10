# 丹丹 · 绑定规范（改任一处必须同步 SKILL.md）
- ../../../docs/shared-contracts.md（契约清单 + §3 登记日志）
- ../../../matrix.config.schema.json（配置 schema）
- ../../docs/03-shared-surface-control.md（面域/权限/锁/登记全文）

## 多变体 App 顶层 app_id 口径
- `matrix.config.json` 顶层 `app_id` = **App 品牌标识**（与目录名一致）；单变体 App 即运行时 AppId，多变体 App 的运行时 AppId 在 `variants[].app_id`
- `AppId` 契约 = **登记制**：新增成员须在 shared-contracts.md §3 当日登记，**禁改名/删除已有成员**；审查 schema/app_id 相关改动时按此口径核对
