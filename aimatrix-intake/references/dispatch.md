# 派单与收口细则（aimatrix-intake 参考）

本文件承载 [`../SKILL.md`](../SKILL.md) §4 硬步骤的完整细则。只在需要判别 Workflow、开单、派单、收口、汇编时读。

## 1. 意图判别（W1–W9）

| 意图 | Workflow | 手册 |
|---|---|---|
| 立项型（「做个 X」「接入新 App」） | **W1** | `docs/05-workflows.md` |
| 共享面变更型（改 packages / services / 根 docs / scripts / infra） | **W3** | 同上 |
| App 内开发型 | **W4** | 同上 |
| 发布型 | **W5** | 同上 |
| 事故型 | **W6** | 同上 |
| 决策查询 | **W7** | 同上 |
| 巡检 | **W8** | 同上 |
| 分支验收合并 | **W9** | 同上 |

**升级预检型**（触发词：「升级」「更新」「检查」×「ai-matrix-team」「AIM」「专家团」，如「升级 AIM」「检查专家团」）：先跑 `node <team-repo>/scripts/aimatrix-preflight.mjs --project <root>`，把三态结论 + 带 ↳ 的建议转述给用户（细节不必展开）；用户点头后再按需开 W3 单执行修复/升级。
**消歧**：裸词「检查/更新/升级」命中时，若上下文有更具体的业务对象（如「检查这个页面」「更新登录逻辑」），按原意图表走，不进预检。
**拿不准 → 按共享面变更型处理（从严）**，并向用户说明。

## 2. 判面域与开单

1. **判面域**：`node <team-repo>/scripts/aimatrix-guard.mjs surface <paths>`。碰 C1/C2 → 必须先开 WO。
2. **开 WO**：按 `<team-repo>/docs/templates/wo.md` 落 `<project>/.ai-matrix-team/runtime/workorders/WO-YYYYMMDD-NN-<slug>.md`，填影响面/验证/回滚/初判破坏性 → `wo lint` 过 → 风控核准（团长兼、自核留痕；Type 1 报创始人终裁）。
3. **验收级别（W9）**：开单时标 `验收级别`——L0 直提 / L1 质检代验收（门禁+代码评审，7 天默认放行）/ **L2 亲验收**（`feat/<WO号>` 分支 → 门禁+评审 → 提请创始人 → 明确验收后 squash 合并 + 打 tag `wo/<WO号>`）；拿不准一律就高 L2；测试通过 ≠ 验收通过。

## 3. 派单与收口

1. **派单**：按 Workflow 逐 Phase spawn 成员（`name` 与 `subagent_type` 都传 Agent ID，禁用中文花名）。成员产出先过 `wo lint`/门禁后收。
2. **派单必带三项**：路径白名单（面域约束）· 「禁止裸用缩写术语」（章程 T4，确需使用须附术语释义表）· 本单 AC。
3. **每 Phase 收口**：跑门禁（typecheck/test 或 `guard dr scan` / `guard report`），不通过原地打回；BLOCKING DR **当轮通报创始人**。
4. **交付汇编**：交接单（模板 `<team-repo>/docs/templates/handoff.md`）+ 一句话结论 + 遗留 DR + 下一步。

## 4. 坑位表

| 症状 | 根因 | 修法 |
|---|---|---|
| 成员改了共享面但没留痕 | 派单时没写面域约束 | WO 里必须列路径白名单；成员 MD 已含「越权即停」 |
| BLOCKING DR 攒了一堆才说 | 怕打扰用户 | 硬纪律：当轮通报；`guard dr scan` 每 Phase 必跑 |
| 两份台账漂移（OPEN-ITEMS vs LEDGER） | 手改渲染产物 | 只改 DR 文件，跑 render-open-items 重渲染 |
| 专家包实例与真源漂移 / 独立包漏同步 | 手改了团队包 agent 文件（它也是 sync 实例） | 只改 `members/*.md` 真源 → expert-sync.mjs（validate→register→package→cache 全链）→ 收口必跑 `guard agents`（含 settings.json 检查） |
| 新特性直接提交 main、测试过了就合并 | 没走分支关卡 | 见本文件 §2.3 W9 风险分级 |
| 交付物里裸用行业缩写（KYB 之类），读者看不懂 | 成员默认读者和自己一样懂 | 章程 T4：派单写明禁裸用缩写；确需使用须附释义表；收口前查一遍，质检抽查 |
