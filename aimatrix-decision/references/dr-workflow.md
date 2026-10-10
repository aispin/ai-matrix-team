# DR 台账与编排细则（aimatrix-decision 参考）

本文件由 [`../SKILL.md`](../SKILL.md) 外移，按需读。

## 2. 硬步骤

1. **生成**：`node <team-repo>/scripts/new-dr.mjs --title "..." --type 1 --blocking --wo WO-xxx --trigger D1 --by "product-designer"`
   → 自动取当日序号，落 `<project>/.ai-matrix-team/runtime/decisions/open/DR-YYYYMMDD-NNN-<slug>.md` 骨架。
2. **补全**：按骨架填「为什么需要你 / 选项表（≥2 方案，标 ✅ 推荐）/ 建议默认值 / 超时行为」。**问题必须是可以回答的判断题或选择题。**
3. **校验**：`node <team-repo>/scripts/aimatrix-guard.mjs wo lint <dr 文件>`（缺字段 = 退出码 5）。
4. **同步台账**：`node <team-repo>/scripts/ledger-sync.mjs`（重建 LEDGER.md，唯一机读真相源）。
5. **当轮通报**：BLOCKING 项**在这一轮**就告知创始人，不许攒。
6. **答复后回填**（谁提出谁回填）：结论写回 BRD/PRD/TDD/ADR/shared-contracts → `ledger-sync.mjs` → 文件移入 `closed/` → 若影响 App 视图：`node <team-repo>/scripts/render-open-items.mjs --app <app> --write`。

## 4. 与 ADR / OPEN-ITEMS 的边界（不许混）

| 东西 | 时态 | 位置 |
|---|---|---|
| DR | 待决策（现在时） | `<project>/.ai-matrix-team/runtime/decisions/open/` |
| ADR | 已决策（过去时） | `docs/decisions/ADR-*`（开发写） |
| OPEN-ITEMS.md | 人类阅读视图 | `apps/<app>/docs/`——**渲染产物**，每条带 DR id，禁止手改台账数据 |
