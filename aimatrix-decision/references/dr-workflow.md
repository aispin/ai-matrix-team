# DR 台账与编排细则（aimatrix-decision 参考）

本文件由 [`../SKILL.md`](../SKILL.md) 外移，按需读。

## 2. 硬步骤

1. **生成**：`node <team-repo>/scripts/aimatrix-guard.mjs dr add --title "..." --opt <方案> --opt <方案> [--recommend <序号>] [--blocking] [--ref WO-xxx]`
   → 自动取当日序号，落 `<project>/.ai-matrix-team/decisions.md` 条目块（长背景可挂 `runtime/dr-details/<DR-id>.md`）。
2. **补全**：方案 ≤3 个、逐项一行，推荐项写序号。**问题必须是可以回答的判断题或选择题。**
3. **校验**：`node <team-repo>/scripts/aimatrix-guard.mjs dr scan --blocking --wo <WO-id>`（退出码 4 = 有 OPEN 的 BLOCKING DR，该单不得进入下一阶段）。
4. **同步台账**：条目块本身就是台账（无需再重建索引）；闭环后 `node <team-repo>/scripts/aimatrix-guard.mjs archive move --kind dr --id <DR-id>`。
5. **当轮通报**：BLOCKING 项**在这一轮**就告知创始人，不许攒。
6. **答复后回填**（谁提出谁回填）：用户在条目「回填」行写结论（格式 `ZEO 10-11 选2`）→ 结论写回 BRD/PRD/TDD/ADR/shared-contracts → `archive move` 收口 → 若影响 App 视图：`node <team-repo>/scripts/render-open-items.mjs --app <app> --write`。

## 4. 与 ADR / OPEN-ITEMS 的边界（不许混）

| 东西 | 时态 | 位置 |
|---|---|---|
| DR | 待决策（现在时） | `<project>/.ai-matrix-team/decisions.md` 条目块 |
| ADR | 已决策（过去时） | `docs/decisions/ADR-*`（开发写） |
| OPEN-ITEMS.md | 人类阅读视图 | `apps/<app>/docs/`——**渲染产物**，每条带 DR id，禁止手改台账数据 |
