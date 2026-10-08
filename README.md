# AI Matrix Team · 五席 AI 交付专家团

[English](README.en.md) | 简体中文

> **给 AI agent 的交付纪律，不是给人看的流程图。** 五席编制，各守一关：立项论证 → 需求与验收 → 编码速断 → 独立质检 → 发布回滚，外加共享面守门。每个阶段过机器门禁，交接单留痕可审计。

我向来是不惮以最坏的恶意来推测甲方与AI的，然而AI Matrix Team，却实在有些特别。这是一个由五席交付团结成的虚拟产研专家阵线，从需求、产品、设计，一路杀到研发、质检与运维，各守一关。风控的守门人，大抵是落在了团长PC的肩上。他们擅长在共享面的泥沼里理出头绪，在多App的交错中交付，在人机决策的边缘试探。

世人总以为排场越大越好，殊不知人一多，不过是白白烧光了词元（Token），活计却还是那些活计；但若人太少，逻辑又要生出混乱，凭空冒出些幻觉来。五人，不多不少，刚刚好。所谓主创者，不过是于深夜的屏幕前，念及十几年走散在各大厂的旧友。虽各奔东西，终是在这虚拟的矩阵里，重聚了。

## 成员介绍

- **PC**（产研高级总监 · 主理人 · 兼风控守门）：现京东资深总监，兼职产研首脑。老广东人，短发，薄肌，大抵是个真汉子。他极擅交际，常引来女设计师与产品经理送的小吃。风控的门，便由他守着罢。
- **毛毛**（资深产品设计师 · BRD→PRD→可交互视觉稿一条链）：前京东的美人，黑长直。如今身兼产品、交互、视觉三职。她是极看透了的，喜欢谈恋爱，却不愿踏进婚姻的坟。这大抵是新时代女性的一种清醒罢。
- **Bruce**（资深研发工程师 · 兼架构速断）：前美团全栈悍将，广东茂名人。终日与编码纠缠还不够，偏要去徒步，去踢足球。南国的烈日，大约给了他无尽的精力。
- **石头**（资深质检工程师 · 独立审计）：中通资深研发专家。广西容县人，两眼一睁，便能看穿千万BUG。若想吃正宗沙田柚，找他，大抵是错不了的。
- **波波**（资深运维工程师 · 发布回滚）：某公司CEO，兼运维工程师。久居西安数十载，80后第一批软件工程师。性格豪爽，极爱饮酒。代码与酒，怕是他生命中唯二的解药。

## 安装：把提示词粘给你的 agent

**普通 agent（Codex / Claude Code）装的是技能；WorkBuddy 装的是整支专家团。** 复制下面任意一段，粘进对应对话框即可，agent 会自己完成剩下的。

**Codex**（装到 `~/.codex/skills/` 或项目 `.agents/skills/`）：

```text
请把 https://github.com/aispin/ai-matrix-team 作为技能安装：clone 到 ~/.codex/skills/ai-matrix-team，然后读它的 SKILL.md，告诉我怎么用
```

**Claude Code**（装到 `~/.claude/skills/` 或项目 `.claude/skills/`）：

```text
请把 https://github.com/aispin/ai-matrix-team 作为技能安装：clone 到 ~/.claude/skills/ai-matrix-team，然后读它的 SKILL.md，告诉我怎么用
```

**WorkBuddy**（专家团形态，整团接入）：

```text
请帮我安装 AI Matrix Team 专家团：https://github.com/aispin/ai-matrix-team ，按 SKILL.md 的流程把五席专家团接入当前项目（生成项目档案、软链激活 Skill、同步安装专家包），最后跑一次门禁体检
```

也可以在 WorkBuddy **专家中心**搜索「AI Matrix Team」直接启用。

## 使用：说一句你要什么

安装完成后，你只负责两件事——**说需求、拍板**。门禁由机器把守：

```text
我要接入一个新 App，走完整立项到上线流程
```

团长 PC 会开工作单（WO）、逐阶段派单：毛毛出 BRD→PRD→设计稿，Bruce 按单施工，石头独立验收，波波负责发布。每个 Phase 过机器门禁，需要人拍板的决策会主动来问你，全部留痕在交接单里。

落地页（在线看能力与成员介绍）：**https://aispin.github.io/ai-matrix-team/**

## 给想读源码的人

本仓与具体项目解耦：治理引擎、角色真源、岗位 Skill、操盘台随本仓走；WO/DR 台账、项目档案、面域规则在目标项目的 `.ai-matrix-team/` 薄层。接入方法见根 [`SKILL.md`](SKILL.md)。

```text
├── SKILL.md            安装器技能（agent 读它即知如何接入/升级/体检）
├── members/            成员真源（五席，一席一份；expert-sync 的类）
├── aimatrix-*/         角色 Skill（9 个：6 岗位 + architect 深读 + guardian 守门 + guard/decision 工具）
├── scripts/            CLI：guard 门禁 · inspect 巡检 · expert-sync 专家包同步 · init 引导 · install 软链 · DR 工具链
├── docs/               治理规范 01-08（charter / roles / 面域 / DR / 工作流 / 落地 / workbuddy 原生 / 可移植）+ index 索引卡 + 模板
├── dashboard/          操盘台（Vite + React，--project 读项目薄层）
├── promo-page/         落地页源码（发布于 gh-pages 分支）
└── assets/             团队总览图 + 成员头像
```

手动接入一个项目（agent 会自动做，这里只给想手工跑的人）：

```bash
node <本仓>/scripts/aimatrix-init.mjs --project <项目根>        # ① 项目档案
node <本仓>/scripts/install-to-workbuddy.mjs --project <项目根>  # ② Skill 软链
node <本仓>/scripts/expert-sync.mjs                              # ③ 专家包安装（首次）
node <本仓>/scripts/aimatrix-guard.mjs agents --project <项目根>  # ④ 体检
```

日常门禁：

```bash
node <本仓>/scripts/aimatrix-guard.mjs --project <项目根> surface <paths...>   # 判面域
node <本仓>/scripts/aimatrix-guard.mjs --project <项目根> check --wo <id> --paths <paths...>
node <本仓>/scripts/aimatrix-guard.mjs --project <项目根> dr scan --blocking --wo <id>
```

治理规则先读 [`docs/index/`](docs/index/) 索引卡；章程见 [`docs/01-charter.md`](docs/01-charter.md)。
