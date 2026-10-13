# Issues · 未处理事项白板

> **用户随手记**：文末追加 `## 标题` + 一句话即可，编号/状态/去向不必填（缺元数据视为草稿，`guard issues normalize` 自动补）。  
> **agent 一律经命令写入**：`guard issues add|triage|close|normalize`。闭环条目整块移入 `runtime/archive/YYYY-MM.md`。  
> 状态：OPEN（待归类）/ TRIAGED（已开单，去向必填）。

## I-029 [规范] 技术方案须先调研选型并按最佳实践目标态推进（建议升为矩阵级规范）
来源: 创始人 2026-10-13 · 来自 ai-matrix-growth WO-20261013-03 10-13 · 状态: OPEN · 去向: — · 更新: 2026-10-13

**背景**：创始人在 ai-matrix-growth 明确要求——「技术方案需做技术调研选型，并按最佳实践目标态推进」，即**不留「先上临时方案、以后再换」的过渡态**。该项目已落为 `docs/spec-tdd.md` §9，首个实例是 payment 计费授权调研（`docs/payment/product/04.research-credit-authorization.md`：5 个一手来源 + 资损敞口量化 + 方案硬化）。

**建议 AIMT 侧动作**（请团队仓维护者裁定落地位置）：

1. **升为矩阵级规范**（与既有「文档不留修订历史 / 命名规范」同域），四条要素：
   - ① 调研以**一手来源**为准（官方文档 / 源码 / 规范 / 厂商 API），每条结论附出处 URL，产出落 `04.research-<模块>.md` 并在 TDD 引用；
   - ② 选型给 **≥2 备选 + 量化对比**（成本 / 可用性 / 资损 / 复杂度 / 回退难度），明确推荐案与理由；有真实取舍记 ADR；
   - ③ **目标态一次做到位**；工期需要分批时，分批只能是「同一目标态的实施顺序」；
   - ④ 涉及**资金 / 安全 / 隐私**的方案必须量化资损或泄露敞口。
   例外：紧急故障处置（恢复后补调研）、纯机械化改动（改名 / 格式 / 依赖补丁）。
2. **进门禁**：TDD/WO 缺调研依据或备选对比 → 质检可打回。建议在 `docs/index/09-wo.md`（填单须知）与 `aimatrix-qa` 的核对清单各加一条。
3. **随接入下发**：`aimatrix-init` / 项目接入流程里把该规范随项目档案同步，避免每个项目各自定义。

**参考实现（可直接搬用）**：`ai-matrix-growth` 的 `docs/spec-tdd.md` §9。

## I-030 [规范] 共享契约 §3 台账可退休：以 commit（带 WO 号）+ WO 详情单为准
来源: 创始人 2026-10-13（ai-matrix-growth 实测后判定） 10-13 · 状态: OPEN · 去向: — · 更新: 2026-10-13

**实测证据（ai-matrix-growth，2026-10-13）**：

1. `guard` **完全不读** `spec-shared-contracts.md`（门禁脚本内 `rg spec-shared-contracts` **0 命中**）；`guard audit` 的「有无单覆盖」是靠 **commit message 里的 WO 号**算的——**门禁与 §3 无关**。
2. 该 §3 台账**占契约文档 95% 字节**（68KB/126 行，其中 §3 约 65KB；69 行、平均 621 字符/行、最长 1880 字符/行），当前契约正文只剩 5% → "又长又臭"。
3. §3 **自身腐坏**：69 行里 **24 行（35%）**仍引用改名前的路径/文档名（`.skills/`、`architecture.md`、`BRD.md`）——一份自己有 1/3 陈旧指向的"审计凭据"已经不能当凭据。
4. §3 的内容**是 commit/WO 单的二手副本**：what 在 git diff，why 在 commit message（本就要求带 WO 号）+ WO 详情单；维护第二份必然漂移，且钝化真正的门禁（人以为"登记过就没问题"，实际校验走的是 commit）。

**创始人判定（2026-10-13）**：vibe coding 项目里，**人类与 agent 都不需要这份日志**（人类看 git；agent 要的是"当前契约现状"+"在办单"+"有无单覆盖"，各有更准的一手源）。唯一独有的「**事前** INTENT」职责，改由 **WO 详情单**承担（模板本就强制写「变更类型 / 影响面 / 验证 / 回滚」四节）。

**建议 AIMT 侧动作**：

1. `aimatrix-guardian` SKILL §5 与 `docs/03-shared-surface-control.md`（§「当日追加 §3 日志」与"破坏性→§3 追加 INTENT"两行）：改为「**commit（message 带 WO 号）+ 本单详情单四节**为准」，不再要求 §3 日志 / §3 INTENT 条目；
2. `docs/templates/wo.md` 收口项「`spec-shared-contracts.md` §3 已登记」→ 改为「**commit 带 WO 号（`guard audit` 可验）+ 详情单影响面已写**」；
3. 保留一处可选说明：若个别项目确有"人要读台账"的合规需求，可自建 `runtime/archive/YYYY-MM.md`（按月归档），**但不作为默认要求**；
4. 同步产品仓：`docs/README.md` §6.2 台账面清单**已移除**该文档（台账面只留 `.aimt/*` 与 `runtime/`）。

**参考实现**：`ai-matrix-growth` 改造后的 `docs/spec-shared-contracts.md`（= 共享面**清单** + 协作纪律，约 4KB；变更记录一律指向 commit + WO 详情单）。
