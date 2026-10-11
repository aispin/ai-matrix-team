# SPEC-20261010-03 · 单据体系迭代：issues 白板 + WO/DR 单表化

> 状态：随 `DR-20261010-003` 待决。本 SPEC 是该 DR 的细则载体（DR 按「精炼铁律」不写落地步骤），采纳后按本文实施。

## 1. 目标

1. 补入口空白：临时问题/需求有处登记（issues），不再散落聊天。
2. 三层收敛一层：DR 由「一文一档 + LEDGER + OPEN-ITEMS」收敛为单表；WO 轻任务一行即单。
3. 守住 token 硬约束：按表读行、免扫目录、渲染层消失。

## 2. 三表结构（放 `<project>/.ai-matrix-team/`，团队仓自管放仓根同路径）

### 2.1 `issues.md` — 未处理事项白板（面向用户 + agent）

**格式：h2 条目块，不用表格**（表格加行需复制管道行，对随手记不友好）：

```markdown
## 登录页偶尔白屏
来源: ZEO 10-10 · 状态: OPEN · 去向: —
```

- **用户零语法**：文末追加一个 `## 标题` + 一句话即完成登记；编号 / 状态 / 去向**都不必填**——缺元数据行的条目视为草稿，guard `issues normalize`（或 agent triage 时）自动补 `I-xxx` 编号与元数据行。用户唯一要会的是「起个标题写句话」。
- **状态**：`OPEN`（待归类）/ `TRIAGED`（已讨论共识、已开单，待归档）。
- **闭环规则（防新流水账）**：条目转成 WO/DR 或明确不做后，**整块移入归档**（见 §2.4），移出前「去向」必填（`→WO-x` / `→DR-x` / `不做+原因`）；条目原文随归档行存活，保证 WO/DR 反向追溯不断链。guard lint：TRIAGED 超 7 天无去向报警。
- **写入约定（防并发冲突）**：用户自由手写；agent 一律经 `guard issues add|triage|close` 单写者命令，顺带 lint。

### 2.2 `workorders.md` — 轻量任务表（面向 agent）

```markdown
| 单号 | 任务名 | 简述 | 关联 | 状态 | 处理者 | 锁定 |
|---|---|---|---|---|---|---|
| WO-20261010-01 | 修登录白屏 | 复现 I-001，定位渲染时序 | I-001·详情单 | EXECUTING | Bruce#b01 | 🔒 |
```

- **状态机**：`TODO → EXECUTING → VERIFYING → DONE`；卡决策 `BLOCKED_DR`。
- **锁定**：`EXECUTING` 即锁定，其他 agent 不得动该单（对齐既有共享锁语义，guard `lock acquire/release` 不变）。
- **格式保留表格**：WO 由 agent 经 guard 独写（无「普通用户手填」问题），一行一单最利于扫读。
- **简述 ≤30 字**，不写技术细节；journal 落 `runtime/journals/<WO-id>.md` 按需读。
- **分级（关键护栏）**：
  - L0/L1 轻任务：「关联」列留空即一行成单，无需详情文件。
  - 触碰 C1/C2 共享面、或验收级别 L2：「关联」列必挂瘦身详情单（`runtime/wo-details/<WO-id>.md`），沿用现有 wo 模板但只强制三字段：**路径白名单 / 验证命令 / 回滚方案**（W3 门禁与 W6 回滚的机器判定输入，不可省）。

### 2.3 `decisions.md` — 决策请求表（面向用户）

**格式：h2 条目块**；全部结构由 agent 生成，**用户唯一动作 = 改「回填」一行**：

```markdown
## DR-20261011-01 迁移工具选 A 还是 B
方案：
1. 自研
2. 复用 cloudbase-migrate
推荐: 2 · 关联: WO-20261010-02 · 状态: OPEN
回填: （待答复，直接改本行）
```

- **方案 ≤3 个**，**有序列表逐项一行**（比斜杠串清晰）；推荐项写序号；长背景落 `runtime/dr-details/<DR-id>.md`（可选）。
- **状态**：`OPEN / ANSWERED / DEFERRED / EXPIRED / WITHDRAWN`（沿用现协议 §4）。
- **回填留痕（硬纪律）**：格式 `ZEO 10-11 选2`——谁+日期+结论（引用方案序号），不许只改状态。这是用户唯一的编辑点，一行搞定。
- D1–D6 触发、BLOCKING 语义、「谁提出谁回填」均沿用 `docs/04-decision-protocol.md`，仅载体从文件改为条目块。

### 2.4 归档机制（三表统一）

- **归档线（终态且收尾完成才移出活动表）**：
  - issues：已转单（去向必填）或明确不做；
  - WO：DONE 且收口完成（锁释放、交接单落盘）；
  - DR：ANSWERED 且结论已回填 docs / DEFERRED / EXPIRED / WITHDRAWN。
- **落点**：`runtime/archive/YYYY-MM.md` 月度文件，append-only；条目带「类型 / 归档日」标注（WO 为表格行，issues/DR 为 h2 块，格式随源表）。
- **行自足（留痕跟着行走）**：归档行必须带全部留痕——issues 行含原始条目全文 + 去向；WO 行含交接单/详情单指针；DR 行含回填原文（谁+日期+结论）。历史查询 `grep runtime/archive/` 一处解决；交叉引用由 guard 扫「活动表 + archive/」校验。
- **兜底 lint**：终态行超 48h 未归档报警，防慢性膨胀。
- 「永远只保留未处理」在**活动表**层面成立；历史层由统一归档承接，三表一律不例外。

## 3. 工作流闭环

```
issues.md + PRD/技术spec（简单需求免spec）
   → agent 归类整合、与用户达成共识
   → workorders.md 加行（+详情单）+ decisions.md 加行
   → 执行（EXECUTING 锁定）→ 收口 DONE
   → 归档闭环单（三表统一移入 archive/YYYY-MM.md）、PRD/spec 同步结论
   → 循环
```

与 W1–W9 关系：issues 取代「散落聊天 + 手开 WO」入口；W3（共享面）/ W9（分支验收）流程原样保留，开单动作变为表加行 + 视情况挂详情单。

## 4. guard 改造清单

| 项 | 动作 |
|---|---|
| 新增 `issues add/triage/normalize` | 白板单写者命令 + lint（去向必填、TRIAGED 超期报警）；`normalize` 为用户手写草稿条目补编号与元数据行 |
| 新增 `archive move/sweep` | 终态行移入 `archive/YYYY-MM.md`（行自足带留痕）；`sweep` 兜底扫超 48h 未归档行报警 |
| 新增 `wo table` 系列 | `wo add/start/done/block`，维护 workorders.md 行与锁定列；校验状态机合法迁移 |
| 统一取号算法 | 编号是一次性资源：任何载体（表行/条目块、详情单目录、归档文本、旧布局）出现即视为已消费，取号 = 全源扫 max+1（WO/Issue/DR 同规）。`wo new` 创建即挂牌（详情单落盘自动补 TODO 表行，幂等）；`wo new --id <行号>` 支持「先表行后详情」绑定；wo 命令收尾检测「今日孤儿详情单」并提示 `wo table add --id <号>` 认领 |
| `wo new` 保留 | 仅用于需详情单的重单（生成瘦身 wo-details） |
| `wo lint` 改造 | 校验三字段（白名单/验证/回滚）仅对详情单；表格行校验简述长度与关联引用存在性 |
| `dr scan` 改造 | 扫 decisions.md 表行替代 `open/*.md`；BLOCKING 语义不变 |
| 退役 `ledger-sync.mjs`、`new-dr.mjs` | ✅ 已退役（2026-10-11 · 引擎 0.7.0）：DR 生成/流转/归档全走 `guard dr add|scan` + `archive move`，载体是 decisions.md 条目块。`render-open-items.mjs` 保留（App 视图渲染） |
| `dr scan --blocking --wo` 门禁 | 保留，改为查表行关联 |

## 5. 迁移步骤（采纳后执行）— 状态：①②③④ 已完成（2026-10-10，WO-20261010-01）

1. [x] 落三表骨架 + guard issues/wo-table/archive 命令（WO-20261010-01）。
2. [x] 存量 open DR 搬入 decisions.md（当时 open 已清零；closed 不迁，历史留原目录只读）。
3. [x] 改造 `dr scan`（双扫 open/ + decisions.md 条目块）/ `wo table` 新命令；已更新 `index/00`、`index/04`、`index/09`。（2026-10-11 · 引擎 0.7.0 收尾：消费端全切三表 + `wo-details/`，`ledger-sync`/`new-dr` 退役）
4. [x] 全链自测：issues add/normalize/triage/close、wo table add/start/verify/done/锁定保护、dr add/scan（含 BLOCKING 退出码 4 与 --wo 过滤）、archive move/sweep（含滞留报警退出码 2）。

## 6. 旧项目升级迁移（不得手动改别人项目）

- **触发方式（仅两种）**：① guard / console **启动钩子自动迁移**——`runtime/state/v2-migrated` marker 缺失且检测到旧单据（open DR 文件或 INDEX.md 活跃行）时静默升级一次，纯新项目写 marker 即走；② 用户对 Agent 显式说「升级」→ 跑 `aimatrix-migrate-v2.mjs --project <root>`。
- **迁移内容**：三表骨架补齐；open DR → decisions.md 条目块（选项表解析、状态/阻塞保留、原文件移 `decisions/migrated/` 只读留档）；INDEX 活跃行 → workorders.md（`DRAFT/APPROVED→TODO`、`IMPLEMENTING→EXECUTING🔒`、`VERIFYING` 沿用、`BLOCKED_DR` 沿用、`DONE→archive`）；INDEX 加冻结注记。LEDGER / OPEN-ITEMS / closed/ 不动（历史只读）。
- **验证规则**：dry-run 先行；验证一律用当前项目或 /tmp 沙箱，**禁止拿其他项目当试验田**。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| issues 变新流水账 | 活动表只留未处理 + 终态 48h 未归档 lint 报警 |
| 归档行丢留痕 | 行自足强制：issues 带原文+去向、WO 带收口指针、DR 带回填原文 |
| 表格并发写坏 | agent 只走 guard 命令；用户手写仅限 issues |
| 轻表丢风控 | C1/C2 与 L2 强制详情单三字段，`wo lint` 门禁 |
| 历史可追溯性 | closed DR 目录只读保留；WO journal 外置不删 |
