---

> 📌 **v1.5（WO-20261007-01）**：新增 `--quiet`（check 单行结论，Agent 消费）与 `stats` 子命令（token 注入面基线）；日常风控由团长兼任后本 SKILL 为团长的机器门禁手册。

name: aimatrix-guard
description: "ai-matrix 机器门禁：面域判定（surface）、写入前校验（check）、串行锁（lock）、DR 扫描（dr scan）、台账格式校验（wo lint）、规范同步提示（sync-check）、无单写入审计（audit）、状态总览（report）。所有角色写受控面前必读必跑。"
version: 1.0.1
---

# aimatrix-guard · 机器门禁（跨角色工具）

**一句话**：把 `<team-repo>/docs/03-shared-surface-control.md` 的规矩变成退出码。**门禁不拦恶意，只让违规可见、可追责。**

## 1. 何时用（全部角色）

| 时机 | 命令 |
|---|---|
| 接到任务先判面域 | `node <team-repo>/scripts/aimatrix-guard.mjs surface <paths...>` |
| 动 C1/C2 前自检 | `… check --wo <WO-id> --paths <paths...>` |
| 提交前（pre-commit 同款） | `… check --wo <WO-id> --staged` |
| C1/C2 写入前抢锁 | `… lock acquire --wo <WO-id> --surfaces <s1,s2>` |
| 进入 VERIFYING 前 | `… dr scan --blocking --wo <WO-id>`（退出码 4 = 停） |
| 落 WO/DR/交接单后 | `… wo lint <files...>`（退出码 5 = 补字段） |
| 改 ★ 契约类文档后 | `… sync-check`（退出码 6 = 提示同步对应 Skill，不阻塞） |
| CI / 巡检 | `… audit --since <sha>`（退出码 2 = 无单写入） |
| 每 Phase 收口 | `… report` |

## 2. 退出码语义（对接 CI / hooks / Agent 判断）

| 码 | 含义 | 处置 |
|---|---|---|
| 0 | 通过 | 继续 |
| 1 | 用法/环境错误 | 修命令 |
| 2 | 越权 / 无单写入 | 停手 → 回守卫扩白名单或补单（RETRO） |
| 3 | 缺 WO / 缺锁 / 锁冲突 / 状态不允许 | 开单或排队，**不硬抢锁** |
| 4 | 存在 OPEN 的 BLOCKING DR | WO 停在 BLOCKED_DR，等人答复 |
| 5 | 台账格式不合规 | 按模板补字段 |
| 6 | ★ 契约文档改了但未见 Skill 同步 | 提示级；交风控（团长兼）裁决 |

## 3. 面域速记（规则源 `<team-repo>/scripts/surfaces.json`）

- **C1**（共享核心，重单）：`packages/shared-types|llm|config|utils`、`services/**`、根 `package.json`/`pnpm-workspace.yaml`/`tsconfig.base.json`/`matrix.config.schema.json`、`.github/**`、根 `.env.example`
- **C2**（轻单）：其余 `packages/**`、根 `scripts/**`、`infra/**`、根 `docs/**`、`<team-repo>/**`（专家团资产，团队仓自管）
- **C3**（App 私有受控）：`apps/*/matrix.config.json`、`apps/*/.env.example`、`apps/*/docs/**` —— 跨 App 影响才开单
- **F**（自由）：`apps/*/src|packages|scripts|public/**` —— 不开单，QA 门禁照跑
- **T**（台账）：`<project>/.ai-matrix-team/runtime/**` —— 任何角色可写，格式套模板
- **S**（跳过）：`.workbuddy/**`、`node_modules`、`dist`
- 拿不准 → `surface` 查；仍拿不准 → 按 C2 处理（从严）。

## 4. 共享锁规则（按面域分片）

共享锁**按面域分片**：面域不相交的多个 WO 可同时持锁，**同面域（冲突面相交）仍互斥**。holder 的冲突面 = 其白名单在 **C1/C2** 面域的子集（**T/F/S 不计入**）。TTL 默认 240min，过期自动释放（写 `guard.log`）；**面域相交才排队**、不硬抢；紧急热修走 W6 例外（24h 内补单 + 交接单标 `EXCEPTION`）。

## 5. 红线

1. **不许绕过 check 直接改 C1/C2**——绕得过脚本，绕不过 CI `audit` 与月度巡检；每次被 audit 抓到 = 一次流程事故。
2. **不许改 `.workbuddy/skills/` 激活点**（软链，机器生成）。
3. commit message 里带 WO 单号（`WO-YYYYMMDD-NN-slug`）——audit 靠它溯源。

## 6. References

- `<team-repo>/docs/03-shared-surface-control.md`（面域/权限/锁/门禁全文）
- `<team-repo>/scripts/surfaces.json`（规则源，与 03 §1 同源）
- `<project>/.ai-matrix-team/runtime/reviews/P1-门禁演练.md`（退出码实测基线）
