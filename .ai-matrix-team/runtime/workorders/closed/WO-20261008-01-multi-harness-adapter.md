# WO-20261008-01-multi-harness-adapter · 任务单

> 模板唯一真相源：`docs/templates/wo.md`。字段缺失 → `guard wo lint` 退出码 5。
> **主文件 ≤6KB 硬上限**：过程叙事禁写本文件，一律 `guard wo journal` 追加至 `WO-20261008-01-multi-harness-adapter.journal.md`。

| 字段 | 值 |
|---|---|
| **id** | `WO-20261008-01-multi-harness-adapter` |
| 状态 | `DONE`（QA 石头 ✅ 放行并准出；已归档） |
| 申请人 | PC（产研高级总监） |
| 执行角色 | `product-designer#1`（spec 需求章节）· `developer#1`（spec 技术设计章节 + 后续编码） |
| 团长（风控例外裁定） | PC · 资深风控师核准（自核留痕）· 2026-10-08 |
| 创建 / 完成 | 2026-10-08 / — |
| 验收级别 | **L1**（质检代验收；创始人已于 DR 环节终裁设计，故不升 L2） |

## 1. 目的与背景

1. 团队仓 harness 适配层当前仅有 `workbuddy` 与 `generic` 两个适配器，创始人要求接入 **codex** 与 **claude-code**，且架构上可持续扩展更多 agent 运行环境。
2. 新增 `docs/specs/` 作为迭代规格文档库（需求 + 技术设计合一），本次即首个落地 spec。
3. 依据：创始人 2026-10-08 指令；既有契约见 `dashboard/server/harness/index.mjs` 头注释与 `docs/08-portability.md §5`。

## 2. 面域与路径白名单

| 面域 | 路径（glob） | 说明 |
|---|---|---|
| C2 | `dashboard/server/harness/*.mjs` | 新增 `codex.mjs` / `claude-code.mjs`；`index.mjs` 仅按 SPEC §4.2④ 加固 id 校验（待拍板 P1，未核准则不动）；`generic.mjs` / `workbuddy.mjs` 一律不动 |
| C2 | `docs/specs/**` | 新建目录 + README + 本次 `SPEC-20261008-01-multi-harness-adapter.md` |
| C2 | `docs/08-portability.md` | §5 补「接新环境」第四条口径（id 命名规则 + 文件须真存在），对齐 AC-8 |
| C2 | `scripts/aimatrix-init.mjs` | **不改**（SPEC §4.2⑤ 结论：已有三级默认值链；改它会让全部已生成档案在 `init --check` 下判漂移） |
| C2 | `dashboard/server/server.mjs` | **仅在待拍板 P2 核准后启用**（修登记表路径偏移需在此注入项目根）；未核准不得写 |
| — | 白名单外一律不得改 | |

> **流程产物豁免**：WO 自身勾选、journal、交接单、DR 文件、`shared-contracts.md` 当日登记属流程产物，可直接写入。

## 3. 变更类型

`additive`（新增文件 + 新增目录；不改既有适配器契约语义；不改在线产物）

## 4. 影响面

- 受影响产物：**仅本地 dashboard 操盘台**（127.0.0.1:4780）实例看板的 harness 展示与实例归属判定。
- 是否需要重部署：**否**（无运行时行为变更 / 无 CORS / 无密钥轮换；dashboard 为本地工具，未对外发布）。

## 5. 验证方式（可机器判定）

```bash
TEAM=/Volumes/Pluto/dev/github/aispin/ai-matrix-team
# ① 面域与门禁自检
node $TEAM/scripts/aimatrix-guard.mjs --project $TEAM surface dashboard/server/harness docs/specs
# ② 两个新适配器可被解析且符合契约（期望：各输出自身 id，不落 generic）
AIMATRIX_HARNESS=codex node -e "import('$TEAM/dashboard/server/harness/index.mjs').then(m=>m.resolveHarness('codex')).then(h=>console.log(h.id))"
AIMATRIX_HARNESS=claude-code node -e "import('$TEAM/dashboard/server/harness/index.mjs').then(m=>m.resolveHarness('claude-code')).then(h=>console.log(h.id))"
# ③ 未知 harness 静默降级（期望：generic，不抛错）
AIMATRIX_HARNESS=nope node -e "import('$TEAM/dashboard/server/harness/index.mjs').then(m=>m.resolveHarness('nope')).then(h=>console.log(h.id))"
# ④ 登记表缺失/坏 JSON 不抛错（期望：[]）
node -e "import('$TEAM/dashboard/server/harness/index.mjs').then(m=>console.log(JSON.stringify(m.readInstancesFile())))"
# ⑤ WO 字段自检 + 体检
node $TEAM/scripts/aimatrix-guard.mjs --project $TEAM wo lint --wo WO-20261008-01-multi-harness-adapter
node $TEAM/scripts/aimatrix-guard.mjs --project $TEAM agents
```

## 6. 回滚方案

回滚 = 删除新增文件并还原**全部**被改文件（质检 DR 复核：漏还原 `server.mjs` 会导致它导入的 `setProjectRoot` 不存在，服务启动即 SyntaxError）：
```bash
# ① 删新增（用 rm 而非 git rm：未提交态下 git rm 不认未跟踪文件，会 exit 128）
rm -f dashboard/server/harness/codex.mjs dashboard/server/harness/claude-code.mjs
# ② 还原被改（用 HEAD 显式指定，两种 git 状态下均有效）
git checkout HEAD -- dashboard/server/harness/index.mjs dashboard/server/server.mjs docs/08-portability.md
# 已提交态另用：git revert --no-commit <本单 commit>
```
（`docs/specs/` 为文档产物，回滚保留即可，不影响运行。`scripts/aimatrix-init.mjs` 本次未改，**不在**回滚清单。）

## 7. 关联 DR

| DR id | 一句话 | 阻塞级别 | 状态 |
|---|---|---|---|
| DR-20261008-001 | spec（需求 + 技术设计）需创始人核准后方可编码 | BLOCKING | OPEN |

> 存在 BLOCKING 且未闭环 → 本 WO 停在 `BLOCKED_DR`（编码阶段前必须 ANSWERED）。

## 8. 团长（风控例外裁定）意见

- [x] 影响面 / 验证方式 / 回滚方案 三齐
- [x] 面域级别与 WO 声明一致（三条路径 guard surface 实测均为 C2）
- [ ] 破坏性 → 事前 INTENT 已登记（本单 `additive`，**不适用**）
- [x] 共享锁已获取（`lock.json` holders 含本 WO）
- 回归范围裁定：**受影响包**（dashboard 本地启动冒烟 + 适配器解析自检）

签名：PC（资深风控师，自核留痕） · 2026-10-08

## 9. 执行记录

- journal：`WO-20261008-01-multi-harness-adapter.journal.md`（N 条）
- spawn 次数：2（product-designer#1 · developer#1）

## 10. 收口

- [x] QA 放行（石头结论：**✅ 放行**；复检报告 `.ai-matrix-team/runtime/reviews/WO-20261008-01-QA复检.md`）
- [x] `shared-contracts.md` §3 已当日登记 —— **不适用**：本仓无该文件；本次未引入跨域/密钥/对外契约（质检 D6 确认）
- [x] 交接单 `.ai-matrix-team/runtime/handoffs/WO-20261008-01-multi-harness-adapter-handoff.md` 已落盘（≤15 行）
- [x] 共享锁已释放
- [x] **术语缩写自检**（章程 T4）：三份文档与代码注释首次出现均附中文释义
- [x] 归档至 `.ai-matrix-team/runtime/workorders/closed/`
