# WO-YYYYMMDD-NN-<slug> · 任务单

> 模板唯一真相源：`docs/templates/wo.md`；**推荐生成**：`guard wo new --slug <kebab> --level L0|L1|L2`（骨架由脚本渲染，模型只填结论）。字段缺失 → `guard wo lint` 退出码 5。
> **主文件 ≤6KB 硬上限**（charter §4A.8，超限风控打回）：TL;DR + 白名单 + 验证 + 回滚 + DR 表 + 勾项。**过程叙事（执行流水、讨论往来、收口细节）禁写本文件**——逐条 `guard wo journal --wo <id> --who <角色#呼号> --what "…"` 追加到同目录 `.journal.md`（append-only，机器写入；读方按需取增量，禁整读旧文）。

| 字段 | 值 |
|---|---|
| **id** | `WO-YYYYMMDD-NN-<slug>` |
| 状态 | `DRAFT` / `APPROVED` / `LOCKED` / `IMPLEMENTING` / `VERIFYING` / `BLOCKED_DR` / `DONE` |
| 申请人 | PC（产研高级总监） |
| 执行角色 | `角色#呼号`（同角色并行实例呼号唯一，单办结后可复用；spawn 后由 PC 登记 `runtime/state/instances.json`。单实例可省 `#呼号`。） |
| 团长（风控核准） | PC（团长 · 风控核准意见 + 日期） |
| 创建 / 完成 | YYYY-MM-DD / — |

## 1. 目的与背景

三行内说清：改什么、为什么现在改、依据（BRD/PRD/TDD/ADR/事故/分析报告的节号）。写不进三行 = 拆单。

## 2. 面域与路径白名单

| 面域 | 路径（glob） | 说明 |
|---|---|---|
| C1/C2/C3/F | `packages/…` | 一行一个，写 glob；扩大 → 回守卫核准 |
| — | （白名单外一律不得改） | |

> **流程产物豁免**：本节只约束**交付物**路径。本 WO 自身的 §8/§10 勾选、journal（`WO-xxx.journal.md`）、交接单（`<project>/.ai-matrix-team/runtime/handoffs/WO-xxx-handoff.md`）、`shared-contracts.md` 当日登记属流程产物，收尾可直接写入；台账仍只经脚本维护。

## 3. 变更类型

`additive` / `非破坏` / **`破坏性`** / `新增契约`（破坏性 → 事前 INTENT + 兼容证明各一行）

## 4. 影响面

- 受影响 App / 服务 / 在线产物：
- 是否需要重部署（运行时行为变更 / CORS / 密钥轮换 三类之一）：

## 5. 验证方式（可机器判定）

```bash
# 3-5 条可复制直跑的命令 + 期望结果（抄来的命令必须先真跑一遍再落单）
```

## 6. 回滚方案

可执行的回退动作（命令 / 开关 / 迁移反向语句），不写「重新部署上一版」这类空话。

## 7. 关联 DR

| DR id | 一句话 | 阻塞级别 | 状态 |
|---|---|---|---|
| DR-YYYYMMDD-NNN | | BLOCKING / NON-BLOCKING | OPEN / ANSWERED |

> 存在 BLOCKING 且未闭环 → 本 WO 停在 `BLOCKED_DR`。

## 8. 团长（风控）意见

- [ ] 影响面 / 验证方式 / 回滚方案 三齐
- [ ] 面域级别与 WO 声明一致
- [ ] 破坏性 → 事前 INTENT 已登记（`shared-contracts.md` §3）
- [ ] 共享锁已获取（`lock.json` `holders` 含本 WO）
- 回归范围裁定：全矩阵 / 受影响包 / 无需跑

签名：PC · YYYY-MM-DD HH:mm

## 9. 执行记录

**不在此展开**——过程叙事一律 `guard wo journal` 追加至 `WO-xxx.journal.md`（章程 §4A.8）。本节仅保留 journal 指针与 spawn 次数：

- journal：`WO-xxx.journal.md`（N 条）
- spawn 次数：0

## 10. 收口

- [ ] QA 放行（石头结论：✅ / ⚠️，Express L0–L2 记一行）
- [ ] `shared-contracts.md` §3 已当日登记（含 WO 号）
- [ ] 交接单 `<project>/.ai-matrix-team/runtime/handoffs/WO-xxx-handoff.md` 已落盘（**≤15 行**：结论行 + 改动清单 + 验证证据指针 + 回滚 + 遗留 DR）
- [ ] 共享锁已释放
- [ ] **术语缩写自检**（章程 T4）：无裸用缩写；确需使用的已附释义表
- [ ] 归档至 `<project>/.ai-matrix-team/runtime/workorders/closed/`
