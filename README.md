# ai-matrix-team · AI-Matrix 专家团（独立真源仓）

五席软件交付专家团：**PC**（产研高级总监·主理人·兼风控守门）· **毛毛**（资深产品设计师：BRD→PRD→可交互视觉稿一条链）· **Bruce**（资深研发工程师·兼架构速断）· **石头**（资深质检工程师·独立审计）· **波波**（资深运维工程师·发布回滚）。

> 本仓与具体项目解耦：治理引擎、角色真源、岗位 Skill、操盘台随本仓走；WO/DR 台账、项目档案、面域规则在目标项目的 `.ai-matrix-team/` 薄层。接入方法见根 [`SKILL.md`](SKILL.md)。

## 目录

```text
├── SKILL.md            安装器技能（agent 读它即知如何接入/升级/体检）
├── members/            成员真源（五席，一席一份；expert-sync 的类）
├── aimatrix-*/         角色 Skill（9 个：6 岗位 + architect 深读 + guardian 守门 + guard/decision 工具）
├── scripts/            CLI：guard 门禁 · inspect 巡检 · expert-sync 专家包同步 · init 引导 · install 软链 · DR 工具链
├── docs/               治理规范 01-08（charter / roles / 面域 / DR / 工作流 / 落地 / workbuddy 原生 / 可移植）+ index 索引卡 + 模板
├── dashboard/          操盘台（Vite + React，--project 读项目薄层）
└── assets/             团队总览图 + 成员头像
```

## 快速接入一个项目

```bash
node <本仓>/scripts/aimatrix-init.mjs --project <项目根>        # ① 项目档案
node <本仓>/scripts/install-to-workbuddy.mjs --project <项目根>  # ② Skill 软链
node <本仓>/scripts/expert-sync.mjs                              # ③ 专家包安装（首次）
node <本仓>/scripts/aimatrix-guard.mjs agents --project <项目根>  # ④ 体检
```

## 日常门禁（项目内）

```bash
node <本仓>/scripts/aimatrix-guard.mjs --project <项目根> surface <paths...>   # 判面域
node <本仓>/scripts/aimatrix-guard.mjs --project <项目根> check --wo <id> --paths <paths...>
node <本仓>/scripts/aimatrix-guard.mjs --project <项目根> dr scan --blocking --wo <id>
```

治理规则先读 [`docs/index/`](docs/index/) 索引卡；章程见 [`docs/01-charter.md`](docs/01-charter.md)。
