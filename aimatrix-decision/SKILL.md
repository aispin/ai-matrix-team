---
name: aimatrix-decision
description: "ai-matrix 决策请求（DR）规范与工具：六类触发判定、DR 生成（new-dr.mjs）、台账同步（ledger-sync.mjs）、OPEN-ITEMS 渲染（render-open-items.mjs）。Agent 遇到只有人能决定的事必须走本流程。"
version: 1.0.1
---

# aimatrix-decision · 人类决策落盘（跨角色工具）

**一句话**：Agent 遇到「只有人能决定」的事，不许自行假设、不许聊天里随口一问就算——**落一张 DR，进台账，带默认建议，BLOCKING 的必须等答复。**

## 1. 六类触发（命中任一必须落 DR）

| # | 类型 | 例 | 默认级别 |
|---|---|---|---|
| D1 | 不可逆承诺（Type 1） | 永久免费、对外定价、合规口径 | BLOCKING |
| D2 | 需要人类凭据/资金/账号 | 建 Dodo 商品、执行迁移、绑 ICP 域名 | BLOCKING |
| D3 | 跨 App 选型 / 破坏性变更 | 新公共服务、AppId 重命名 | BLOCKING（破坏）/ NON-BLOCKING（additive） |
| D4 | 目标或资源冲突 | 两 App 争同一契约 | BLOCKING |
| D5 | 事实缺失且拿不到 | 市场数据、法务口径 | NON-BLOCKING（带假设与 Plan B） |
| D6 | 碰红线 | 生产写操作、默认域上生产、成本超阈 | BLOCKING |

**不许拿来打扰人的**：栈内自决的技术选择、代码风格、测试粒度、文件组织——自行决定，写进交接单「我已替你决定」。

## 2. 硬步骤

1. **生成**：`node <team-repo>/scripts/new-dr.mjs --title "..." --type 1 --blocking --wo WO-xxx --trigger D1 --by "product-designer"`
   → 自动取当日序号，落 `<project>/.ai-matrix-team/runtime/decisions/open/DR-YYYYMMDD-NNN-<slug>.md` 骨架。
2. **补全**：按骨架填「为什么需要你 / 选项表（≥2 方案，标 ✅ 推荐）/ 建议默认值 / 超时行为」。**问题必须是可以回答的判断题或选择题。**
3. **校验**：`node <team-repo>/scripts/aimatrix-guard.mjs wo lint <dr 文件>`（缺字段 = 退出码 5）。
4. **同步台账**：`node <team-repo>/scripts/ledger-sync.mjs`（重建 LEDGER.md，唯一机读真相源）。
5. **当轮通报**：BLOCKING 项**在这一轮**就告知创始人，不许攒。
6. **答复后回填**（谁提出谁回填）：结论写回 BRD/PRD/TDD/ADR/shared-contracts → `ledger-sync.mjs` → 文件移入 `closed/` → 若影响 App 视图：`node <team-repo>/scripts/render-open-items.mjs --app <app> --write`。

## 3. 硬纪律

1. **BLOCKING 不闭环，相关 WO 不得进入下一阶段**：`guard dr scan --blocking --wo <id>` 退出码 4 即停。
2. **Type 1 不许沉默通过**：BLOCKING 不因超时自动按默认执行，必须显式答复。
3. **NON-BLOCKING 48h 无答复按默认执行**，台账标注「按默认执行 + 日期」，结论可被推翻（推翻代价写进 DR）。
4. 答复必须有**原文留痕**（谁、哪天、选了什么）。

## 4. 与 ADR / OPEN-ITEMS 的边界（不许混）

| 东西 | 时态 | 位置 |
|---|---|---|
| DR | 待决策（现在时） | `<project>/.ai-matrix-team/runtime/decisions/open/` |
| ADR | 已决策（过去时） | `docs/decisions/ADR-*`（开发写） |
| OPEN-ITEMS.md | 人类阅读视图 | `apps/<app>/docs/`——**渲染产物**，每条带 DR id，禁止手改台账数据 |

## 5. 度量目标

DR 闭环率（近 30 天）≥80% · BLOCKING 平均等待 ≤2 天 · 静默假设事故 = 0 · 每周新增 DR ≤8（超标 = 门槛设低，回看触发类型）。

## 6. References

- `<team-repo>/docs/04-decision-protocol.md`（规范全文）
- `<team-repo>/docs/templates/dr.md`（模板）
- `<team-repo>/scripts/new-dr.mjs` / `ledger-sync.mjs` / `render-open-items.mjs`
