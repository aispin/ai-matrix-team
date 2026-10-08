---
name: ai-matrix-team
description: "AI Matrix Team 安装器：agent 读完本文件即知如何把专家团接入任意项目——生成项目档案、软链激活 Skill、同步安装专家包（团队包 + 独立专家）、跑通门禁体检。也用于体检/升级已接入的项目。"
version: 2.0.0
---

# ai-matrix-team · 专家团安装器

本仓库是 **AI Matrix 五席交付专家团**的独立真源仓。用户说「接入/安装/升级 AI Matrix Team」或「给这个项目配上专家团」时，按本文件执行。

## 团队构成（v2.0 · 五席）

| Agent ID | 花名 | 职业 | 岗位 Skill |
|---|---|---|---|
| `aimatrix-team-team-lead` | PC | AIM产研高级总监（主理人） | aimatrix-intake |
| `aimatrix-team-product-designer` | 毛毛 | AIM资深产品设计师 | aimatrix-product-designer |
| `aimatrix-team-developer` | Bruce | AIM资深研发工程师 | aimatrix-developer（深读 aimatrix-architect） |
| `aimatrix-team-qa` | 石头 | AIM资深质检工程师 | aimatrix-qa |
| `aimatrix-team-devops` | 波波 | AIM资深运维工程师 | aimatrix-devops |

分发形态：专家团包 `ai-matrix-team`（WorkBuddy 专家中心）+ 两个独立专家 `aimatrix-team-team-lead`、`aimatrix-team-product-designer`（项目任务挂载用，WorkBuddy 项目任务不提供团队 tab）。

## 安装步骤（对新项目，按序执行）

```bash
TEAM=<本仓库绝对路径>          # 即本 SKILL.md 所在目录
PROJECT=<目标项目绝对路径>

# ① 生成项目档案（扫描项目结构 → <PROJECT>/.ai-matrix-team/project.json）
node $TEAM/scripts/aimatrix-init.mjs --project $PROJECT

# ② Skill 软链激活（<PROJECT>/.workbuddy/skills/aimatrix-* → 团队仓；幂等）
node $TEAM/scripts/install-to-workbuddy.mjs --project $PROJECT

# ③ 专家包同步安装（团队包 + 2 独立包：validate→register→package→cache→登记）
node $TEAM/scripts/expert-sync.mjs

# ④ 门禁体检（全绿才算接入完成）
node $TEAM/scripts/aimatrix-guard.mjs agents --project $PROJECT
node $TEAM/scripts/aimatrix-guard.mjs --project $PROJECT surface packages
```

安装完成后提示用户**重开 WorkBuddy 会话**生效；专家在「专家中心-我的专家」可见。

## 升级 / 体检（已接入的项目）

```bash
node $TEAM/scripts/expert-sync.mjs --check     # 专家包与真源漂移检查（退出码 1 = 有漂移）
node $TEAM/scripts/expert-sync.mjs             # 重新同步安装（改过 members/ 后必跑）
node $TEAM/scripts/install-to-workbuddy.mjs --check --project $PROJECT   # Skill 链路巡检
node $TEAM/scripts/aimatrix-guard.mjs agents --project $PROJECT          # 一键体检
node $TEAM/scripts/aimatrix-init.mjs --check --project $PROJECT          # 项目档案新鲜度
```

## 纪律（硬规则）

1. **成员真源唯一**：改成员定义只改 `members/<role>.md`，然后跑 `expert-sync.mjs`；**严禁手改任何包内实例文件**。
2. **项目数据不入团队仓**：WO/DR 台账、项目档案、面域规则都在 `<project>/.ai-matrix-team/`；团队仓只放引擎与规范。
3. **CLI 一律带 `--project <root>`**（或环境变量 `AIM_PROJECT_ROOT`）；团队引擎不硬编码任何项目路径。
4. **WorkBuddy watcher 陷阱**：专家包源目录新建文件可能数秒内被清——以 cache 安装快照为准，体检脚本已内置降级检查。
5. 日常开工流程、面域分级、Express 模式等治理规则见 `docs/index/`（先读索引卡再读正文）。
