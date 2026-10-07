# DR-YYYYMMDD-NNN · 待你拍板 / 待你提供

> 模板唯一真相源：`docs/templates/dr.md`。
> 规则：Type 1 / BLOCKING 不许沉默通过；NON-BLOCKING 48h 无答复按默认执行（须在台账标注）。

| 字段 | 值 |
|---|---|
| **id** | `DR-YYYYMMDD-NNN` |
| 提出者 | `<角色>·<Agent ID>` |
| 所属 | WO-xxxx / App: `<app>` / 契约: `<contract>` |
| **决策类型** | Type 1（不可逆）/ Type 2（可逆） |
| **阻塞级别** | BLOCKING / NON-BLOCKING |
| 触发类型 | D1 不可逆承诺 / D2 凭据 / D3 选型·破坏性 / D4 冲突 / D5 事实缺失 / D6 红线 |
| 提出日期 | YYYY-MM-DD |
| 期限 | YYYY-MM-DD（NON-BLOCKING 默认 +48h） |
| **状态** | OPEN / ANSWERED / DEFERRED / EXPIRED / WITHDRAWN |

---

## 1. 问题（一句话，必须可回答）

## 2. 为什么需要你

我做不了：______ ／ 不该替你决定：______（二选一或都写，不许空着）

## 3. 选项

| 方案 | 代价 | 收益 | 推荐 |
|---|---|---|---|
| A | | | |
| B | | | ✅ |
| C | | | |

## 4. 建议默认值

> 你回一句「按默认」我就直接推进：________________

## 5. 不做的后果 / 超时行为

- BLOCKING：任务停在 ______ 阶段，等你答复。
- NON-BLOCKING：48h 无答复 → 按 §4 默认执行，可在台账标注后推翻（推翻代价：______）。

## 6. 影响面

受影响 App / 服务 / 已上线产物 / 对外承诺：

## 7. 关联文档

`BRD §x` · `PRD §y` · `TDD §z` · `ADR-xxxx` · `WO-xxxx` · `OPEN-ITEMS.md §A2`

---

## 8. 答复（创始人填写 / 由 Agent 回填原文）

- 答复人：创始人 · 日期：
- 结论：选 ______ ／ 按默认 ／ 其他：______
- 原文：

## 9. 回填记录（提出者关闭 DR 前必填）

- [ ] 结论已写回：`BRD §x` / `PRD §y` / `TDD §z` / `ADR-xxxx` / `shared-contracts.md` / 代码注释（勾选实际项）
- [ ] LEDGER.md 已更新（`<team-repo>/scripts/ledger-sync.mjs`）
- [ ] 若影响 App 的 OPEN-ITEMS：`<team-repo>/scripts/render-open-items.mjs` 已同步
- [ ] 文件移入 `decisions/closed/`
