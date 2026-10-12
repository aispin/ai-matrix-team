---
name: aimatrix-decision
description: "ai-matrix 决策请求（DR）规范与工具：六类触发判定、经 guard dr add 落 decisions.md 条目块、archive move 收口。Agent 遇到只有人能决定的事必须走本流程。"
version: 1.1.0
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

## 2. 怎么落（v2：decisions.md 条目块）

`guard dr add --title "问题" --opt "方案1" --opt "方案2" --recommend <序号> [--blocking] [--ref <关联单号>]` —— 一条命令写入 `<project>/.aimt/decisions.md`，h2 条目块（问题 · 方案有序列表 · 推荐序号 · 状态 · 回填行）。

- **用户唯一编辑点 = 「回填」行**：格式 `ZEO MM-DD 选<序号>`（谁+日期+结论），同时把状态改 `ANSWERED`。
- 收口：答复落定后 `guard archive move --kind dr --id <DR-id>` 整块移入 `runtime/archive/YYYY-MM.md`（回填原文随行存活）。
- 长背景可选落 `runtime/dr-details/<DR-id>.md`，条目块内不展开。

## 3. 硬纪律

1. **BLOCKING 不闭环，相关 WO 不得进入下一阶段**：`guard dr scan --blocking --wo <id>` 退出码 4 即停。
2. **Type 1 不许沉默通过**：BLOCKING 不因超时自动按默认执行，必须显式答复。
3. **NON-BLOCKING 48h 无答复按默认执行**，回填行标注「按默认执行 + 日期」，结论可被推翻（推翻代价写进 DR）。
4. 答复必须有**原文留痕**（谁、哪天、选了什么）——只改状态不留痕 = 违规。
5. **精炼（省 token 硬纪律）**：DR 条目块只抛「**背景 3–5 句 · 选项（含推荐）· 不做的后果 2–3 句**」。禁止写取证表 / 方案细则 / 铁律清单 / 落地步骤——细则落 `runtime/dr-details/`。**细则写进条目块 = 让创始人多读几千字 = 直接违背专家团「不制造 token 爆炸」的目标**。

## 5. 度量目标

DR 闭环率（近 30 天）≥80% · BLOCKING 平均等待 ≤2 天 · 静默假设事故 = 0 · 每周新增 DR ≤8（超标 = 门槛设低，回看触发类型）。

## 按需读：硬步骤 / 与 ADR 的边界（不许混）

已外移至 [`references/dr-workflow.md`](references/dr-workflow.md)（保持 SKILL 精简；需要细则时读那一份）。

## 6. References

- `<team-repo>/docs/04-decision-protocol.md`（规范全文）
- `<team-repo>/docs/index/04-decision-protocol.md`（索引卡）
- `guard dr add / dr scan / archive move|sweep`（v2 命令族，用法见 aimatrix-guard SKILL）
