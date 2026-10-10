# SPEC-20261010-01 · 上下文成本治理与操盘台可用性

> 关联 WO：无（团队仓自身迭代，无目标项目在办单）
> 关联 DR：[`DR-20261010-001`](../../.ai-matrix-team/runtime/decisions/closed/DR-20261010-001-设计稿渲染是否引入-HeroUI-Tailwin.md)（渲染链路选型，已闭环「维持 B1」）· [`DR-20261010-002`](../../.ai-matrix-team/runtime/decisions/closed/DR-20261010-002-脱离既有设计系统的-全新视觉-出稿支持-模式-A.md)（全新视觉出稿通道，已闭环）
> 定位：本次迭代的**唯一设计真相源**；与代码冲突时以本文为准并回写代码。
> 说明：本迭代需求在会话内逐项拍定（选型类走两项 DR 留痕），本文为**事后合稿**——规格口径以落地后的实测值为准（AC 全部实跑过）。

## 1. 背景与目标

团队仓有两条不可让的约束（见 [`MEMORY.md`](../../.workbuddy/memory/MEMORY.md)）：**① 从混乱到有序**；**② 不能因为引入 ai-matrix-team 引起 token 大爆炸**。

本次迭代把「贵在哪」拆成四处，逐个治理：

| 贵的来源 | 表现 | 治理方向 |
|---|---|---|
| 模型**读**治理文档 | 每次 spawn 读全文（角色定义 + 岗位 SKILL + 手册） | 三层拆分 + 按需读索引卡 |
| 模型**写**交付物 | 设计稿手写整页 HTML/CSS/交互（20–65KB/份） | 产物外置渲染：模型只写草稿 JSON |
| **规约靠正文说教** | 「禁止 XX」写在文档里，靠自觉 | 规则即代码：能退出码判定的事不写正文 |
| **单据越长越贵** | DR 曾写到 4.9KB、WO 曾到 40KB | 体量硬上限 + 机器门禁 |

**目标（可量化）**：岗位 SKILL 总量显著下降；单次 spawn 按需载荷降半；设计稿模型侧输出降 8 成；单据体量有机器上限；且**能力上限不降**（覆盖不了必须显式失败，不许静默降级）。

## 2. 需求范围

### A · 上下文成本治理

| 编号 | 需求 | 落点 |
|---|---|---|
| A1 | **产物外置渲染**：模型只写草稿 JSON，HTML/CSS/SVG/主题/状态/交互由脚本生成 | `scripts/aimatrix-render.mjs` + [`design-draft-spec.md`](../../aimatrix-product-designer/references/design-draft-spec.md) |
| A2 | **spawn 载荷瘦身**：岗位 SKILL ≤5KB、角色定义 ≤3.5KB，细则入 `references/` 按需读 | `aimatrix-*/SKILL.md` · `members/*.md` · `docs/index/` |
| A3 | **规则即代码**：自检/门禁固化为脚本与 CI，不在正文写说教 | `scripts/aimatrix-repo-check.mjs` · `aimatrix-guard.mjs` · `.github/workflows/ci.yml` |
| A4 | **单据精炼**：DR ≤2.5KB（只抛背景/选项/后果）、WO ≤6KB 且 §5 必含可执行命令 | `docs/templates/dr.md` · `docs/templates/wo.md` · `docs/index/09-wo.md` |

### B · 出稿能力边界（「省 token」不得以降低能力为代价）

| 编号 | 需求 |
|---|---|
| B1 | **三级处置**：能表达 → 渲染；差一点 → 该区块 `raw` 局部手写；差很多 → 整页照 `examples/` 手写 |
| B2 | **覆盖不了显式失败**：草稿出现未知组件 → 退出码 1 且**不产出文件**，并打印三级处置（禁止静默残缺稿） |
| B3 | **外壳逐字对齐 `examples/`**：布局/顶栏/侧栏/两段式收起等一律取示例数值，不自创 |
| B4 | **出稿模式 A/B/C**：A 延续（默认）/ B 视觉换新 / C 全新方向；B·C 手写且禁用渲染器，工程质量铁律仍适用 |

### C · 操盘台可用性

| 编号 | 需求 |
|---|---|
| C1 | **多项目并行**：汇报库按项目分文件；端口被占自动 +1；日志按项目分开 |
| C2 | **档案口径统一**：正式名 `project.json`（旧名 `config.json` 仅作读取兜底）；`init` 重跑不得覆盖人工项 |
| C3 | **样式可靠性**：修掉「整条规则不进构建」的根因；主题相关配色全部令牌化，禁用硬编码浅色 |
| C4 | **一键开关**：一条命令完成「生成汇报 → 重启服务 → 打印实际地址」 |

### 不做（out of scope，均有据）

| 项 | 理由 |
|---|---|
| 引入 HeroUI + Tailwind **同栈运行时**（B2 方案） | `DR-20261010-001` 裁定挂起；复开条件见 §7 |
| 常驻渲染**服务**（B3 方案） | 出稿是低频操作，常驻进程运维为负收益 |
| 3D / 强定制插画组件化 | 属视觉新形态，声明走手写路径 |
| `02-roles` 继续压缩 | 剩余为编制表/概念关系/真源纪律，均承载性内容 |
| `05-workflows` 命令化下沉 | 本质是流程手册，且 `intake/references/dispatch.md` 已有摘要 |
| devops 席位撤裁 | 证据仅「暂无云后端项目」，改为**按需席位**而非撤裁 |

## 3. 验收标准（AC · 逐条机器可判定，均已实跑）

| # | 判据 | 期望 |
|---|---|---|
| AC1 | `node scripts/aimatrix-repo-check.mjs` | 退出码 0，末行「✓ 团队仓自检全过（9 个岗位技能、5 个角色定义）」 |
| AC2 | `node scripts/aimatrix-guard.mjs stats --project .` | 「spawn 期望载荷 … 按需 ≈ 7.8KB」（实测值，预算 ≤10KB）；且 9 个 SKILL 逐个 ≤5KB（由 `repo-check` 三层阈值强制） |
| AC3 | `aimatrix-render.mjs --in <草稿> --stats` | landing 降幅 ≥85%、dashboard ≥75%；raw 占比 0% |
| AC4 | 含未知组件的草稿渲染 | 退出码 1，**不产出文件**，输出「未知组件类型「kanban」」与三级处置 |
| AC5 | 超 2.5KB 的 DR 放进 `decisions/open/` 后 `guard dr scan --project .` | 非 0 退出码，输出「⚠ x.xKB > 2.5KB」 |
| AC6 | 超 6KB 的 WO `guard wo lint` | 非 0 退出码，输出「主文件 x.xKB 超 6KB 上限」；`wo new` 生成的骨架 lint 应通过 |
| AC7 | 人为制造注释不配对的 `.css` 后 `repo-check` | 退出码 1，输出「注释未配对：/* n 个 vs */ m 个」 |
| AC8 | `curl -s -o /dev/null -w '%{http_code}' 127.0.0.1:4780/` | `200`；`dashboard/data/console-<project>.json` 存在且含 `pid/port/project` |
| AC9 | 汇报 SVG 令牌（隔离页注入 `dist` 的 CSS，读 `--rp-*`） | 见 §6 实测表；两主题均**不得**出现浅色块当底 |

## 4. 技术设计

### 4.1 渲染链路（A1）

```
模型侧（唯一的逐次成本）
  drafts/<场景>.draft.json      ← 页面/组件/文案/data-ui 标注，2.7–5.4KB
        │  node scripts/aimatrix-render.mjs --in <draft> --out <page.html>
脚本侧（一次性成本，不进模型上下文）
  <单文件 HTML>                  ← 全部结构/CSS 令牌/SVG 图标/主题/收起/八态/tabs 交互内建
```

- **组件词汇**（草稿 `sections[].type`）：`stats` `cards` `table` `form` `chat` `list` `tabs` `kv` `notice`，营销页另加 `hero` `features` `compare` `cta`，逃生舱 `raw`。字段口径见 [`design-draft-spec.md`](../../aimatrix-product-designer/references/design-draft-spec.md)。
- **版式**：`layout: "marketing"` 走落地页版式（隐藏侧栏与收起钮、内容居中 1080px）；缺省为应用版式（232px 侧栏 + 60px 顶栏）。
- **成本摊薄**：脚本约 37KB 为一次性；每次出稿省 21–24KB → **约 2 次出稿摊平**，此后净收益。

### 4.2 spawn 载荷结构（A2）

| 层 | 体量上限 | 读法 |
|---|---|---|
| 角色定义 `members/*.md` | ≤3.5KB | spawn 必读（角色均 ≈3.0KB） |
| 岗位 SKILL `aimatrix-*/SKILL.md` | ≤5KB | spawn 必读（均 ≈3.3KB） |
| 细则 `references/*.md` | — | **按需**读（有明确触发条件才读） |
| 索引卡 `docs/index/*.md` | — | 先读索引卡再决定读不读正文（10 张 / 7.8KB，单张 ≈0.8KB） |

### 4.3 单据门禁（A3 · A4）

| 单据 | 体量上限 | 强制内容 | 门禁 |
|---|---|---|---|
| DR | 2.5KB（主文件） | 背景 3–5 句 · 选项（含推荐）· 不做后果 2–3 句；**禁**取证表/细则/清单/落地步骤 | `guard dr scan`（对 open 单） |
| WO | 6KB（主文件） | §1 目的 ≤3 行、§2 面域与路径白名单、§5 **必须含可执行命令** | `guard wo lint` |
| 全库 | — | 无修订痕迹（WO 号/日期括注/版本括注/过程用语）；CSS 注释配对 | `repo-check`（CI 每次 push 跑） |

### 4.4 操盘台（C1–C4）

| 维度 | 设计 |
|---|---|
| 双根 | `TEAM_ROOT` = 服务脚本上级目录（固定，团队仓）；`ROOT` = `--project/--root/cwd`（可变，被看项目的台账） |
| 数据 | 汇报库 `<team-repo>/dashboard/data/db/<project>.db`（按项目分文件，与 `aimatrix-report.mjs` 同源） |
| 端口 | 默认 4780；`EADDRINUSE` → 自动 +1 重试（最多 20 次），并打印实际端口 |
| 进程 | 状态文件 `dashboard/data/console-<project>.json`（pid/port/project/startedAt）；**不依赖 `ps`**（沙箱禁用） |
| 启动 | `node scripts/aimatrix-console.mjs --project <根>`：生成汇报 → 停旧实例并重启 → 打印地址；`--keep` 只看不动、`--no-report` 只保服务 |
| 前端 | Vite + React + HeroUI + Tailwind；产物 `dashboard/dist/`（**不入库**），改样式须 `pnpm build`；服务端改代码/`about.json` 须重启 |

### 4.5 样式架构与令牌（C3）

- 样式分两个文件：`src/styles.css` + `src/app-extras.css`。拆分起因（已定位根因）：`styles.css` 注释正文里混入 `*/` → **注释提前收尾，紧随其后的整条规则被构建丢弃**（曾导致浅色令牌块与约 43% 样式不进产物）。该 `*/` 已修，`repo-check` ⑥ 已固化门禁；两文件**保持拆分现状**（无合并必要）。
- **铁律**：注释正文里不得出现 `*/`（如需写通配，用 `--n-* / --brand` 形式）。
- 主题相关配色**一律走令牌**，禁硬编码浅色（暗色下必坏）。汇报图形版专用令牌（两主题下都必须保持深底/对应色）：

| 令牌 | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--rp-banner-bg` | `#1C1917` | `#0B0E14` | 收尾金句条底 |
| `--rp-banner-text` | `#FCD9A8` | `#FCD9A8` | 金句条文字 |
| `--rp-decide-bg` / `--rp-decide-stroke` | `#FFFBF5` / `#FFC97A` | `#2A1D10` / `#7C3A12` | 「等您拍板」卡 |
| `--rp-blue-stroke` | `#BFDBFE` | `#2A4A7A` | 蓝 chip 描边 |
| `--rp-green-text` | `#047857` | `#6EE7B7` | 「在办」行文字 |

> 教训：`--rp-ink` 语义是**文字色**（浅近黑/暗近白），**不可当底色**——金句条暗色变白块即此因。

### 4.6 出稿模式（B4）

模式 A/B/C 的触发条件、出稿路径、授权人、以及**10 条铁律的适用边界**（工程质量类仍适用 / 风格类可放宽 / 渲染器组件词汇不适用）见 [`design-draft.md` §10](../../aimatrix-product-designer/references/design-draft.md)（单一真相源，本文不复制）。

### 4.7 影响面

| 面 | 变更 |
|---|---|
| 团队仓脚本 | `aimatrix-render.mjs`（组件+版式+统计）、`aimatrix-repo-check.mjs`（新增 ⑥ 注释配对）、`aimatrix-guard.mjs`（WO 门禁 + 模板驱动生成）、`aimatrix-console.mjs`（新增）、`aimatrix-report.mjs`（库路径 + 令牌化配色） |
| 团队仓文档 | `docs/templates/{dr,wo}.md`、`docs/index/00-commands.md`、`docs/index/09-wo.md`、`docs/specs/README.md`、`aimatrix-*/references/*` |
| 操盘台 | 后端 `dashboard/server/server.mjs`（分库/端口/端点/头像/产物内容）、前端 `src/**`（侧栏目录、产物预览、主题令牌） |
| 对外承诺 | 专家团 **0.5.9**、独立专家 **0.1.5**（`VERSION` + `SOLO_VERSION`）；需**重开会话**生效，Codex 侧需重扫技能列表 |

## 5. 兼容与风险

| 项 | 处置 |
|---|---|
| 破坏性：专家包版本变更 | 非破坏（内容新增）；生效需重开会话——属已知操作约束，非缺陷 |
| 破坏性：`project.json` 取代 `config.json` | 读取侧保留旧名兜底 + 提示对齐，不崩 |
| 破坏性：汇报库从单例改按项目分文件 | 旧单例库保留为 `report` 侧一次性迁移源，历史汇报不丢 |
| 破坏性：渲染器未知组件从「静默降级」改为「显式失败」 | **有意的破坏性变更**：宁可失败也不交付残缺稿；三级处置已写入岗位手册 |
| 降级路径 | 渲染不完全 → `raw` 局部手写 → 整页手写（能力上限不变） |
| 回滚 | 全部为仓库内文件改动，`git revert` 即可；无不可逆数据迁移 |
| 残留风险 1 | 渲染色与 `dashboard` 存在 9 项令牌值差异——`DR-20261010-001` 定案：**稿侧为真相源，不统一**；同栈搬运若底座不同，由目标项目自行发 DR |
| 残留风险 2 | 两个样式文件保持拆分（根因已除但未合并），新增样式**建议加在 `app-extras.css`** |
| 残留风险 3 | `raw` 占比尚无真实需求样本（当前两份样例均为 0%），「多数渲染 vs 多数手写」待实测 |

## 6. 验证命令（可复制直跑 · 实测值取自本次实测）

```bash
# AC1 全库自检（含 9 技能 / 5 角色 / 链接 / 修订痕迹 / CSS 注释配对）
node scripts/aimatrix-repo-check.mjs
#   → exit 0 · ✓ 团队仓自检全过（9 个岗位技能、5 个角色定义）

# AC2 上下文成本度量
node scripts/aimatrix-guard.mjs stats --project .
#   → 角色 SKILL.md 9 个 / 29.3KB · 索引卡 10 张 / 7.8KB
#   → spawn 期望载荷 最坏 16.3KB / 按需 ≈ 7.8KB

# AC3 设计稿渲染收益
node scripts/aimatrix-render.mjs --in aimatrix-product-designer/drafts/01-landing.draft.json --stats
#   → 模型侧输出降幅 89.8% · raw 局部手写 0 处 / 5 个区块 0%
node scripts/aimatrix-render.mjs --in aimatrix-product-designer/drafts/02-dashboard.draft.json --stats
#   → 模型侧输出降幅 79.5% · raw 局部手写 0 处 / 9 个区块 0%

# AC4 覆盖不了必须显式失败（含未知组件的草稿）
node scripts/aimatrix-render.mjs --in /tmp/bad.json --out /tmp/bad.html; echo $?
#   → exit 1 · 未知组件类型「kanban」· 未产出文件

# AC5 / AC6 / AC7 三个体量门禁
node scripts/aimatrix-guard.mjs dr scan --project .      # 超 2.5KB 的 open DR → 非 0 退出码
node scripts/aimatrix-guard.mjs wo lint <超出或 §5 无命令的 WO>  # → 非 0 退出码
node scripts/aimatrix-repo-check.mjs                     # 注释不配对的 .css → exit 1

# AC8 操盘台
node scripts/aimatrix-console.mjs --project .            # 生成汇报 + 重启 + 打印实际地址
curl -s -o /dev/null -w '%{http_code}\n' --noproxy '*' http://127.0.0.1:4780/   # → 200

# AC9 汇报图形版令牌（隔离页注入 dist 的 CSS，读两主题实际值）
```

AC9 实测值（隔离页读 `getComputedStyle(documentElement).getPropertyValue('--rp-*')`）：

| 令牌 | 浅色 | 深色 |
|---|---|---|
| `banner-bg` | `#1c1917` | `#0b0e14` |
| `banner-text` | `#fcd9a8` | `#fcd9a8` |
| `decide-bg` | `#fffbf5` | `#2a1d10` |
| `decide-stroke` | `#ffc97a` | `#7c3a12` |
| `blue-stroke` | `#bfdbfe` | `#2a4a7a` |
| `green-text` | `#047857` | `#6ee7b7` |

补充人工验证（无法机器判定的部分）：控制台浅色恢复底座渐变、暗色金句条为深底暖字、深色开关切页无 JS 报错、375px 无横向滚动。

## 7. 待拍板

**无未闭环 DR**（台账 open = 0）。以下为**条件触发项**，命中即重开评估、不必现在决定：

| 触发条件 | 动作 |
|---|---|
| 目标项目确认采用 **HeroUI + Tailwind + React** | 重开一单评估「同栈运行时」（落地方式：复用 `dashboard/` 现有构建，不新起 service） |
| 某类 `raw` 在 **≥2 个场景**出现或单稿 **≥3 次** | 按准入规则升级为组件（并须让草稿侧更省） |
| 有**真实业务需求**跑 3–5 次出稿 | 用 `--stats` 的 `raw 占比` 与「未知组件报错次数」定「多数渲染 vs 多数手写」 |
| 出现云后端项目 | devops 席位由「按需」转实战 |
| 用户要求「不用我们模板出全新设计」 | 按出稿模式 B / C 走（`design-draft.md` §10） |

## 8. 关联

- 决策单：[`DR-20261010-001`](../../.ai-matrix-team/runtime/decisions/closed/DR-20261010-001-设计稿渲染是否引入-HeroUI-Tailwin.md)（渲染链路选型）· [`DR-20261010-002`](../../.ai-matrix-team/runtime/decisions/closed/DR-20261010-002-脱离既有设计系统的-全新视觉-出稿支持-模式-A.md)（全新视觉通道）· 台账 [`LEDGER.md`](../../.ai-matrix-team/runtime/decisions/LEDGER.md)
- 规范真相源：[`design-draft-spec.md`](../../aimatrix-product-designer/references/design-draft-spec.md)（草稿字段与三级处置）· [`design-draft.md`](../../aimatrix-product-designer/references/design-draft.md)（出稿模式与样式规范）· [`portability-map.md`](../../aimatrix-product-designer/references/portability-map.md)（稿→实现搬运与令牌差异）· [`design-system.md`](../../aimatrix-product-designer/references/design-system.md)（设计系统基座）
- 单据规范：`docs/templates/dr.md` · `docs/templates/wo.md` · `docs/index/09-wo.md`（面向 agent 的写单须知）
- 操作手册：`aimatrix-intake/references/reporting.md`（操盘台开关台）
- 样例：`aimatrix-product-designer/drafts/01-landing.draft.json` · `02-dashboard.draft.json`
