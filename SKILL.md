---
name: ai-matrix-team
description: "AI Matrix Team 安装器：agent 读完本文件即知如何把专家团接入任意项目——获取真源、生成项目档案、建立平台激活入口、同步安装专家包、跑通门禁体检。也用于体检/升级已接入的项目。平台无关：WorkBuddy / Claude Code / Codex 通用。"
version: 2.1.0
---

# ai-matrix-team · 专家团安装器

本仓库是 **AI Matrix 五席交付专家团**的独立真源仓。用户说「接入/安装/升级 AI Matrix Team」或「给这个项目配上专家团」时，按本文件执行。

## 环境前置

- **Node ≥ 22.5**（引擎脚本使用 `node:sqlite`）。先 `node -v` 确认，低于此版本先升级再继续。

## 分支判断（先于一切步骤）

- 目标项目已存在 `<PROJECT>/.ai-matrix-team/` → **跳过下方「安装步骤」，直接走「升级 / 体检」**：体检全绿即接入完成；有漂移按脚本提示跑对应 `--fix` 对齐后复检。已接入项目禁止重跑全新安装覆盖。
- 不存在 → 按下方「安装步骤」全新接入。

## 团队构成（五席）

| Agent ID | 花名 | 职业 | 岗位 Skill |
|---|---|---|---|
| `aimatrix-team-team-lead` | PC | AIM产研高级总监（主理人） | aimatrix-intake |
| `aimatrix-team-product-designer` | 毛毛 | AIM资深产品设计师 | aimatrix-product-designer |
| `aimatrix-team-developer` | Bruce | AIM资深研发工程师 | aimatrix-developer（深读 aimatrix-architect） |
| `aimatrix-team-qa` | 石头 | AIM资深质检工程师 | aimatrix-qa |
| `aimatrix-team-devops` | 波波 | AIM资深运维工程师 | aimatrix-devops |

岗位技能**不进任何平台的技能列表**：agent 按团队仓路径直读 `<TEAM>/aimatrix-<role>/SKILL.md`。项目级只暴露本文件这一个激活入口（见安装步骤 ②）；若项目技能目录下发现指向本仓的 `aimatrix-*` 链接，直接删除——那是把岗位技能错误暴露进用户技能列表的产物。

分发形态：WorkBuddy 平台另有专家团包 `ai-matrix-team` + 两个独立专家 `aimatrix-team-team-lead`、`aimatrix-team-product-designer`（见安装步骤 ③）。

## 安装步骤（对新项目，按序执行）

```bash
# ⓪ 获取真源（已在本仓内可跳过）
TEAM=<本仓库绝对路径>          # 即本 SKILL.md 所在目录；clone 到任意位置均可，不要求与项目同级
PROJECT=<目标项目绝对路径>

# ① 生成项目档案（扫描项目结构 → <PROJECT>/.ai-matrix-team/project.json）
node $TEAM/scripts/aimatrix-init.mjs --project $PROJECT

# ② 激活入口（按目标平台执行其一）
```

**② 的平台做法**（共同原则：真目录 + 链单个 SKILL.md 文件——平台若递归扫描技能目录，链仓根会把岗位技能暴露出来；文件级链接在递归/非递归下都只暴露一个入口）：

| 平台 | 激活入口 | 做法 |
|---|---|---|
| **`.agents/skills/`**（中性聚合点） | `<PROJECT>/.agents/skills/ai-matrix-team/SKILL.md` | `mkdir -p` 真目录后 `ln -s $TEAM/SKILL.md <入口路径>`。VS Code / Copilot 默认扫描此目录；同一目录可并列本组织其他技能，本团队只占 `ai-matrix-team/` 一个位置 |
| WorkBuddy | `<PROJECT>/.workbuddy/skills/ai-matrix-team/SKILL.md` | 同上 |
| Claude Code | `<PROJECT>/.claude/skills/ai-matrix-team/SKILL.md` | 同上（SKILL.md 格式原生兼容） |
| Codex | `<PROJECT>/AGENTS.md` | 壳文件：内容只有指向 `$TEAM/SKILL.md` 的指针（用实际绝对/相对路径写明，带 `<!-- managed-by: ai-matrix-team -->` 标记）；项目已有 AGENTS.md 则把指针**合并**进去，不覆盖 |

> 各平台各扫自家目录，互不代扫：同时用多个工具时按需各建一条（`aimatrix-verify-skills.mjs` 逐个独立校验，不要求全建）。
> **软链一律写绝对路径**（`ln -s $TEAM/SKILL.md …`）：相对目标要相对**入口自身目录**解析，层级算错即 drift；绝对路径无此歧义，且 `$TEAM` 本可位于任意位置。

```bash
# ③ 专家包安装（WorkBuddy 平台；其他平台跳过本步）
node $TEAM/scripts/expert-sync.mjs   # 团队包 + 2 独立包：validate→register→package→cache→登记

# ④ 门禁体检（全绿才算接入完成）
node $TEAM/scripts/aimatrix-guard.mjs agents --project $PROJECT
node $TEAM/scripts/aimatrix-guard.mjs --project $PROJECT surface packages
node $TEAM/scripts/aimatrix-verify-skills.mjs --project $PROJECT   # 激活入口校验（退出码 0 = 就绪）
```

WorkBuddy 平台安装完成后提示用户重开会话生效；专家在「专家中心-我的专家」可见。

## 升级 / 体检（已接入的项目）

```bash
node $TEAM/scripts/aimatrix-verify-skills.mjs --project $PROJECT   # 激活入口巡检（退出码 1 = 缺失/漂移）
node $TEAM/scripts/aimatrix-init.mjs --check --project $PROJECT    # 项目档案新鲜度
node $TEAM/scripts/aimatrix-guard.mjs agents --project $PROJECT    # 一键体检
node $TEAM/scripts/expert-sync.mjs --check                         # 专家包与真源漂移检查（退出码 1 = 有漂移；WorkBuddy 平台）
node $TEAM/scripts/expert-sync.mjs                                 # 重新同步安装（改过 members/ 后必跑；团队仓维护动作）
```

## 纪律（硬规则）

1. **成员真源唯一**：改成员定义只改 `members/<role>.md`，然后跑 `expert-sync.mjs`；**严禁手改任何包内实例文件**。
2. **项目数据不入团队仓**：WO/DR 台账、项目档案、面域规则都在 `<project>/.ai-matrix-team/`；团队仓只放引擎与规范。
3. **CLI 一律带 `--project <root>`**（或环境变量 `AIM_PROJECT_ROOT`）；团队引擎不硬编码任何项目路径。
4. **WorkBuddy watcher 陷阱**：专家包源目录新建文件可能数秒内被清——以 cache 安装快照为准，体检脚本已内置降级检查。
5. **激活入口是软链不是副本**：真相源要跟着 git 走（可 review / 可回滚 / 可被巡检读）；复制会产生两份漂移副本。
6. 日常开工流程、面域分级、Express 模式等治理规则见 `docs/index/`（先读索引卡再读正文）。
