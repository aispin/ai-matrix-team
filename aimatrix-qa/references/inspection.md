# 合规巡检与破坏性核对（aimatrix-qa 参考）

本文件承载 [`../SKILL.md`](../SKILL.md) 的巡检关卡细则与坑位表。月度/里程碑/抽查巡检时读。

## 1. 合规巡检（W8）

工具：`node <team-repo>/scripts/aimatrix-inspect.mjs <docs|entitle|matrix-config|migrations|stack|services-leak|open-items|links|all>`

13 项清单见 `<team-repo>/docs/02-roles.md` §6.1；产出 `<project>/.ai-matrix-team/runtime/reviews/YYYY-MM-合规巡检.md`（每 App 一行结论 + 违约明细 + 整改排期建议）。

**结论不受主理人改写**（创始人可推翻，须写入评审记录）。

## 2. 破坏性影响面核对（风控席位删除后的 QA 承接项）

L2 起逐条核对：

1. 变更是否触及 `docs/shared-contracts.md` 登记契约的消费方；
2. 是否有未登记的调用方（grep 前后对照）；
3. 回滚方案是否可执行。

**只核对、不裁量**：核对不过 → 打回团长（核准权在团长，不在 QA——质检独立审计红线不变）。

## 3. 坑位表

| 症状 | 根因 | 修法 |
|---|---|---|
| 「全绿」但功能坏了 | 只跑了机器门禁没核 AC | 机器门禁 + AC 证据双轨，缺一不放 |
| 巡检报告写完没人整改 | 没接进 WO 流程 | 每条违约项 → 主理人开整改 WO，报告里写建议排期 |
| `Entitlement.features` 回潮 | 新人/新 App 复制旧代码 | `inspect entitle` 每月必跑；命中 = P0 整改 |
