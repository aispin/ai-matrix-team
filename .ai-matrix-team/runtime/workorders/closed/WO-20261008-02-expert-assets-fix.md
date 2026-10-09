# WO-20261008-02-expert-assets-fix · 任务单

> 模板唯一真相源：`docs/templates/wo.md`。字段缺失 → `guard wo lint` 退出码 5。
> **主文件 ≤6KB 硬上限**：过程叙事禁写本文件，一律 `guard wo journal` 追加至 `WO-20261008-02-expert-assets-fix.journal.md`。

| 字段 | 值 |
|---|---|
| **id** | `WO-20261008-02-expert-assets-fix` |
| 状态 | `DONE`（2026-10-08 收口：交付已提交 b05bf6c 推送 origin/main；QA 一级验收因 429 频率限制未独立执行，按 Express L2 留痕——执行者六项验证全绿 + PC 抽查复核 + 头像 MD5 逐一相符） |
| 申请人 | PC（产研高级总监） |
| 执行角色 | `developer#1` |
| 团长（风控例外裁定） | PC · 资深风控师核准（自核留痕）· 2026-10-08 |
| 创建 / 完成 | 2026-10-08 / — |
| 验收级别 | **L1**（质检代验收；涉及对外可见的专家包产物） |

## 1. 目的与背景

1. 创始人反馈「团员头像似乎不对」。排查结论：**头像源文件齐全且内容正确**（`assets/avatars/` 五席齐全，与专家包内文件 MD5 逐一比对一致），问题在同步脚本——`scripts/expert-sync.mjs` 第 216 行把团队包成员头像复制为 `avatars/${r.id}.png`（带 id 前缀），而第 92 行成员元数据引用 `avatars/${r.avatar}`（不带前缀），**两处命名口径不一致 → 5 席中 4 席头像指向不存在的文件**，第 5 席靠旧编制残留的同名文件侥幸命中。
2. 专家包目录残留旧编制文件（5 个旧 agent 定义 + 5 个旧头像），需随本次一并清理。
3. 专家包校验有 2 条非阻塞警告：简介中文 55 字符（建议 40–50）、缺 `README.md`。

## 2. 面域与路径白名单

| 面域 | 路径（glob） | 说明 |
|---|---|---|
| C2 | `scripts/expert-sync.mjs` | 修头像命名口径；缩简介；补 README 生成；清理逻辑 |
| C2 | `assets/avatars/**` | 仅在需要新增/替换头像源文件时改（**现有 5 席头像不得改动**） |
| — | 白名单外一律不得改 | |

> **运行态产物豁免**：专家包实例目录（`~/.workbuddy/plugins/marketplaces/my-experts/plugins/ai-matrix-team*/`、`~/.workbuddy/plugins/cache/my-experts/*`）与打包产物（`~/WorkBuddy/ISkills/expert-dist/*.zip`）由 `expert-sync.mjs` 重建，属运行态，不列为受控交付路径。

## 3. 变更类型

`非破坏`（修脚本缺陷 + 清残留；不删任何在用的正确资产，不新增契约）

## 4. 影响面

- 受影响产物：**专家包对外形象**（WorkBuddy 专家中心里的团队头像与五席成员头像）、打包 zip。
- 是否需要重部署：**否**（无运行时行为变更 / 无 CORS / 无密钥轮换）；**需重开 WorkBuddy 会话**生效。

## 5. 验证方式（可机器判定）

```bash
TEAM=/Volumes/Pluto/dev/github/aispin/ai-matrix-team
PKG=~/dev/workbuddy_cache/.workbuddy/plugins/marketplaces/my-experts/plugins/ai-matrix-team
NODE=~/.workbuddy/binaries/node/versions/22.22.2-6/bin/node

# ① 面域自检（期望：两条均 C2）
env -u NODE_OPTIONS $NODE $TEAM/scripts/aimatrix-guard.mjs --project $TEAM surface scripts/expert-sync.mjs assets/avatars

# ② 成员头像引用逐一存在（期望：5 席全部 ✅ 存在，无一缺失）
for a in team-lead developer product-designer qa devops; do
  printf 'avatars/%-18s ' "$a.png"; [ -f "$PKG/avatars/$a.png" ] && echo "✅" || echo "❌ 缺失"; done

# ③ 头像内容与真源一致（期望：5 席 MD5 逐一相等）
for a in team-lead developer product-designer qa devops; do
  printf '%-18s ' "$a"; md5 -q $TEAM/assets/avatars/$a.png; md5 -q $PKG/avatars/$a.png; done

# ④ 旧编制残留已清（期望：无 implementer/qa-inspector/release-engineer/product-designer/ai-matrix-team-team-lead 旧文件）
ls $PKG/agents/ $PKG/avatars/

# ⑤ 专家包同步全链 + 体检（期望：CHECK OK · 散件齐全 · 简介警告清零）
env -u NODE_OPTIONS $NODE $TEAM/scripts/expert-sync.mjs
env -u NODE_OPTIONS $NODE $TEAM/scripts/expert-sync.mjs --check
env -u NODE_OPTIONS $NODE $TEAM/scripts/aimatrix-guard.mjs --project $TEAM agents
```

## 6. 回滚方案

```bash
# ① 还原脚本（本次唯一受控源码改动）
git checkout HEAD -- scripts/expert-sync.mjs
# ② 重建专家包回到修复前状态
env -u NODE_OPTIONS ~/.workbuddy/binaries/node/versions/22.22.2-6/bin/node scripts/expert-sync.mjs
```
（`assets/avatars/**` 若未改动则不回滚；**严禁删除任何头像源文件**。）

## 7. 关联 DR

| DR id | 一句话 | 阻塞级别 | 状态 |
|---|---|---|---|
| — | 本单无需拍板（创始人已示意见即修） | — | — |

## 8. 团长（风控例外裁定）意见

- [x] 影响面 / 验证方式 / 回滚方案 三齐
- [x] 面域级别与 WO 声明一致（两条均 C2，guard surface 实测）
- [ ] 破坏性 → 事前 INTENT 已登记（本单非破坏，**不适用**）
- [x] 共享锁已获取（`lock.json` holders 含本 WO）
- 回归范围裁定：**受影响包**（专家包同步全链 + 体检）

签名：PC（资深风控师，自核留痕） · 2026-10-08

## 9. 执行记录

- journal：`WO-20261008-02-expert-assets-fix.journal.md`（N 条）
- spawn 次数：1（developer#1）

## 10. 收口

- [ ] QA 放行（石头结论：✅ / ⚠️）
- [ ] 交接单 `.ai-matrix-team/runtime/handoffs/WO-20261008-02-expert-assets-fix-handoff.md` 已落盘（≤15 行）
- [ ] 共享锁已释放
- [ ] **术语缩写自检**（章程 T4）：无裸用缩写
- [ ] 归档至 `.ai-matrix-team/runtime/workorders/closed/`
