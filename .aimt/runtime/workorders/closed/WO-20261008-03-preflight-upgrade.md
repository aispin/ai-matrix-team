# WO-20261008-03-preflight-upgrade · 任务单

| 字段 | 值 |
|---|---|
| **id** | `WO-20261008-03-preflight-upgrade` |
| 状态 | `DONE`（Express L2 自验：AC-1~7 全实测 ✓，预检复跑仅剩本单在途与未提交两项提醒） |
| 申请人 | PC（产研高级总监） |
| 执行角色 | PC（Express 代行，创始人 2026-10-08 16:55 明示「直接实现」；charter §4A 治理工具迭代零 spawn） |
| 团长（风控例外裁定） | PC 兼（自核留痕）· 2026-10-08 |
| 资深风控师 | PC 兼（自核留痕）· 2026-10-08 |
| 创建 / 完成 | 2026-10-08 / — |

## 1. 目的与背景

创始人说「升级 ai-matrix-team / 检查 AIM」撞不进自然语言路由，升级前检查（档案漂移 / 专家包漂移 / 软链 / 在途工单 / 未闭环决策单）靠临场记得跑。本单：一键预检脚本 + 版本号闭环（VERSION 单源 + 档案戳记）+ WO/DR 汇报 + 触发词词典。

## 2. 面域与路径白名单

| 面域 | 路径（glob） | 说明 |
|---|---|---|
| C2 | `scripts/aimatrix-preflight.mjs` | 新增：六项检查聚合，三态结论 |
| C2 | `scripts/aimatrix-init.mjs` | 改：engineVersion 戳记 + --check 比对 |
| C2 | `scripts/expert-sync.mjs` | 改：TEAM_VERSION 改读 VERSION（单一版本源） |
| C2 | `VERSION` | 新增（0.5.0） |
| C2 | `aimatrix-intake/SKILL.md` | 改：升级/更新/检查触发词词典 |
| C2 | `members/team-lead.md` | 改：同上 |
| C2 | `docs/specs/**` | SPEC-20261008-02 文档 |
| — | （白名单外一律不得改） | |

> 流程产物豁免：journal、交接单、勾选项按章程 §4A.8 直写。

## 3. 变更类型

`additive` / `非破坏`——preflight 独立新脚本（只读为主，`--fix` 仅合并 engineVersion 单字段）；init --check 新增版本比对项，结构比对不动；expert-sync 版本常量换数据源（生成物版本号不变）。

## 4. 影响面

- 受影响 App / 服务 / 在线产物：无业务侧；治理工具自身
- 是否需要重部署：否（本地命令行工具；Skill/专家包重开会话生效）

## 5. 验证方式（可机器判定）

```bash
# V1 预检跑通（对团队仓自身）
node scripts/aimatrix-preflight.mjs --project <team-repo>          # 六项逐一输出，三态结论
# V2 版本闭环：改 VERSION 为 9.9.9 → 两处都报差异；--fix 补记后复跑转绿
node scripts/aimatrix-init.mjs --project <p> --check               # 版本不一致 → exit 1
node scripts/aimatrix-preflight.mjs --project <p> --fix            # 仅补 engineVersion，其余字段字节不变
# V3 触发词落点
grep -c "预检" aimatrix-intake/SKILL.md members/team-lead.md       # 各 ≥1
# V4 门禁全绿
node scripts/aimatrix-guard.mjs --project <p> dr scan              # 无未闭环 BLOCKING
```

## 6. 回滚方案

```bash
git checkout HEAD -- scripts/aimatrix-init.mjs scripts/expert-sync.mjs aimatrix-intake/SKILL.md members/team-lead.md
rm -f scripts/aimatrix-preflight.mjs VERSION
```

## 7. 关联 DR

| DR id | 一句话 | 阻塞级别 | 状态 |
|---|---|---|---|
| —（无） | 设计取舍已在 §3 写明，无待拍板分歧 | — | — |

## 8. 团长（风控例外裁定）意见

- [x] 影响面 / 验证方式 / 回滚方案 三齐
- [x] 面域级别与 WO 声明一致（五条实测 C2）
- [x] 破坏性 → 非破坏，无需 INTENT 登记
- [x] 共享锁已获取（WO-02 已收口释放后重取）
- 回归范围裁定：受影响包 = 治理脚本自身（V1–V4 即全量）

签名：PC（兼风控） · 2026-10-08 16:58

## 9. 执行记录

- journal：`WO-20261008-03-preflight-upgrade.journal.md`（N 条）
- spawn 次数：0（Express 代行）

## 10. 收口

- [x] QA 放行（Express L2 留痕：PC 自验 V1–V4 + dr scan 全绿；无 shared-contracts.md，登记项不适用）
- [x] `shared-contracts.md` §3 不适用（本仓无该文件，QA 前轮已确认）
- [x] 交接单已落盘（≤15 行）
- [x] 共享锁已释放
- [x] 术语缩写自检：无裸用缩写
- [x] 归档至 `workorders/closed/`
