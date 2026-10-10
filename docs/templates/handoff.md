# WO-YYYYMMDD-NN-<slug> · 交接单（Handoff）

> 任何 WO 收尾必产（章程 T3）。模板唯一真相源：`docs/templates/handoff.md`。

| 字段 | 值 |
|---|---|
| WO | `WO-YYYYMMDD-NN-<slug>` |
| 完成日期 | YYYY-MM-DD |
| 产研高级总监 | PC |
| 参与角色 | PC / 毛毛 / Bruce / 石头 / 波波（勾选） |
| 关联评审 | `<project>/.ai-matrix-team/runtime/reviews/xxx.md` |

## 1. 一句话结论

这次做了什么，现在处于什么状态（可用 / 待验证 / 部分上线 / 已回滚）。

## 2. 改动清单

| 面域 | 路径 | 改动性质 | 备注 |
|---|---|---|---|
| C1/C2/C3/F | | additive / 非破坏 / 破坏性 | 含 WO 号 |

> 有例外（`EXCEPTION`，如热修后补单）在此标注原因与时间。

## 3. 验证证据（不是结论，是证据）

```text
pnpm -r typecheck  → 全绿（贴输出尾行）
pnpm -r test       → xx/xx 通过
pnpm -r build      → 全绿
healthcheck.mjs    → 全绿
冒烟：登录 ✓ / 权益 200 ✓ / webhook ✓
```

## 4. 契约登记

- [ ] 已追加 `shared-contracts.md` §3（含 WO 号）／ 不涉及共享面
- [ ] 破坏性 → 事前 INTENT 已登记

## 5. 回滚方式

具体命令 / 开关 / 反向迁移；已演练：是 / 否。

## 6. 遗留 DR

| DR id | 一句话 | 阻塞级别 | 状态 |
|---|---|---|---|

## 7. 我已替你决定（可推翻）

| 决策 | 我的选择 | 推翻代价 |
|---|---|---|

## 8. 遗留风险与下一步

| # | 风险/待办 | 严重度 | 建议处理时点 |
|---|---|---|---|

## 9. 流程事故记录（若有）

无单写入 / 越界 / 未 INTENT / 忘释放锁 —— 记一次，写清根因与防复发动作。
