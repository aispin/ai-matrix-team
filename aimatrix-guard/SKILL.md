---
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

## 5. 红线

1. **不许绕过 check 直接改 C1/C2**——绕得过脚本，绕不过 CI `audit` 与月度巡检；每次被 audit 抓到 = 一次流程事故。
2. **不许改 `.workbuddy/skills/` 激活点**（软链，机器生成）。
3. commit message 里带 WO 单号（`WO-YYYYMMDD-NN-slug`）——audit 靠它溯源。

## 按需读：面域速记（规则源 `<team-repo>/scripts/surfaces.json`） / 共享锁规则（按面域分片）

已外移至 [`references/rules.md`](references/rules.md)（保持 SKILL 精简；需要细则时读那一份）。

## 6. References

- `<team-repo>/docs/03-shared-surface-control.md`（面域/权限/锁/门禁全文）
- `<team-repo>/scripts/surfaces.json`（规则源，与 03 §1 同源）
- `<project>/.ai-matrix-team/runtime/reviews/P1-门禁演练.md`（退出码实测基线）
