# AIM-T 指南（AIM-T Guide · 通用范本）

> **AIM-T 是什么**：**AIM-T = AI Matrix Team**——一套独立维护的「交付专家团」，提供岗位技能、引擎脚本与治理规范，用来给项目做**研发流程规范化管理**。本文档统一简称 **AIM-T**（不再写作 `ai-matrix-team` 或"团队仓"）。
>
> **本文件的身份**：这是 **AIM-T 官方范本**。项目接入 AIM-T 时，本文件被带到 `<项目>/.ai-matrix-team/AIM-T-Guide.md`。
> ⚠️ **该副本由 AIM-T 维护**：升级 AIM-T 时会被覆盖，**项目不得就地修改**；项目自己的补充写在**项目侧的研发流程文档**里（见 §10）。
>
> 记号：`$AIMT` = AIM-T 所在目录（真源仓绝对路径）；`$PROJECT` = 接入项目根目录。

> **读者**：**本文档面向 agent 会话（AI 助手）**。**人类读者无需通读本文**——项目负责人只需要关注两处：① 项目侧研发流程文档（如 `docs/workflow.md`）里"你要做的事"；② 需要你**拍板的 DR** 与需要你**亲手操作的配置**（密钥 / 账号 / 域名 / 结算账户等）。其余机制由 agent 按本文执行。

## 0. 30 秒速览

1. 项目**接入 AIM-T** 后，研发流程由**机器门禁**兜底（不靠自觉）。
2. **开工三件套**：`guard surface <路径>`（判面域）→ 需要授权就 `wo new` + `lock acquire` + `check` → 写码时 commit 带 **WO 单号**。
3. **收口三件套**：跑测试/构建 → `wo journal` → `wo table verify`（→ `done`）+ `lock release`。
4. **只有人能拍板的事走 DR**：agent 开单（`dr add`），由项目负责人在台账「回填」行答复，agent 据此执行并 `archive move` 闭环。
5. **AIM-T 升级后**：把 AIM-T 的**每一份副本**都 pull 到同一版本，再跑预检/体检（§5）。

## 1. AIM-T 是什么

AIM-T 是**独立于项目**的真源仓（仓库名 `ai-matrix-team`，工程内统一称 AIM-T）：

| 组成 | 内容 |
|---|---|
| 岗位技能（9 个） | `aimatrix-intake`（主理人/派单）· `aimatrix-product-designer`（BRD/PRD/视觉稿）· `aimatrix-architect`（TDD/选型/兼容判定）· `aimatrix-developer`（落码）· `aimatrix-qa`（质检放行）· `aimatrix-devops`（部署）· `aimatrix-guard`（机器门禁）· `aimatrix-guardian`（共享资产守门）· `aimatrix-decision`（DR 规范） |
| 引擎脚本 | `aimatrix-guard.mjs`（面域/校验/锁/单据/审计）· `aimatrix-init.mjs`（项目档案）· `aimatrix-preflight.mjs`（升级预检）· `aimatrix-migrate-v2.mjs`（结构迁移）· `aimatrix-verify-skills.mjs`（入口巡检）· `expert-sync.mjs`（WorkBuddy 专家包）· `aimatrix-report.mjs` 等 |
| 治理规范 | `docs/01-charter.md` … `docs/08-portability.md` · `docs/index/`（写作与派单细则） |
| 角色定义 | `members/`（五席：主理人 / 产品设计 / 研发 / 质检 / 运维） |
| 模板 | `templates/`（如本文件 `AIM-T-Guide.md`） |

**与项目的关系（三条硬规矩）**：

1. **AIM-T 是工具的唯一真源**；项目侧 `.ai-matrix-team/` 只放**项目数据**（面域规则、工单台账、决策台账、问题白板、执行记录），**不回流 AIM-T**。
2. **岗位技能不进任何平台的技能列表**：agent 按 `$AIMT/aimatrix-<role>/SKILL.md` 直读；平台只暴露**一个激活入口**（§6）。
3. **同一个 AIM-T 在本机可能有多份副本**（真源仓 + 各客户端用的 clone）——升级时最容易踩的坑（§8 坑 1）。

**为什么需要它**：受控面（共享契约、跨模块影响、对外承诺）不能靠"我记得改一下"，要有**可执行门禁**——面域判定、写入前校验、串行锁、无单写入审计、单据格式 lint。

## 2. 目录与文件地图

### 2.1 项目侧（接入后自动出现）

```text
<项目>/.ai-matrix-team/
├── AIM-T-Guide.md      # 本文件（AIM-T 维护、升级覆盖；勿改）
├── project.json        # 项目档案（生成物：仓库结构、workspace globs、引擎版本）
├── surfaces.json       # 面域规则（C1/C2/C3/F → 路径 glob → 写入要求）
├── workorders.md       # 工单台账（表行是唯一真相源：id/slug/简述/DR/状态/执行角色/锁/更新日）
├── decisions.md        # 决策台账（DR：方案 / 推荐 / 回填 / 状态）
├── issues.md           # 问题白板（用户随手记 + agent 经命令写入）
└── runtime/
    ├── wo-details/     # 每张 WO 的详情单（§2 白名单）+ journal 执行日志
    ├── decisions/      # DR 原单（migrated/ 历史）与闭环归档
    ├── handoffs/       # 交接单
    ├── reviews/        # 评审 / 质检产物
    ├── state/          # 锁与服务状态
    └── archive/        # 按月归档（YYYY-MM.md：闭环的 DR/WO/issue 整块搬入）
```

### 2.2 AIM-T 侧（工具）

```text
$AIMT/
├── SKILL.md                   # 安装器（唯一平台激活入口指向它）
├── VERSION                    # 引擎版本号
├── aimatrix-<role>/SKILL.md   # 9 个岗位技能
├── scripts/                   # 引擎脚本（§1）
├── members/                   # 角色定义
├── templates/                 # 范本（本文件所在）
└── docs/                      # 治理规范与 index
```

## 3. 基础迭代流程（一次需求的完整链路）

| 步 | 做什么 | 命令 / 判据 |
|---|---|---|
| 0 | **判断意图类型** | 回答·诊断类（只读，不动受控面）· 变更类（走 WO）· 只有人能拍板（走 DR） |
| 1 | **判面域** | `node $AIMT/scripts/aimatrix-guard.mjs surface <路径…>`：F 自由面 · C3 私有受控 · C2 共享外围（轻单）· C1 全局受控 |
| 2 | **开单**（受控面才需要） | `wo new --slug <kebab> --level L2 --surface C2 --paths "a/**,b/**" --purpose "…"` → 填详情单 §1/§2/§5/§6 → `wo lint <详情单>` |
| 3 | **取锁 + 写入前校验** | `wo table start --id WO-… --who "<角色#呼号>"` → `lock acquire --wo WO-…` → `check --wo WO-… --paths …`（三者都过才可写） |
| 4 | **写文档 / 设计** | 按项目文档体例（AIM-T `docs/index/` 有 WO/DR/评审标准）；**文档只体现最新状态**；缩写首现写「中文（英文全词）」 |
| 5 | **落码** | 小步提交，**commit message 带 WO 单号**；破坏性变更加 `!` |
| 6 | **验证** | 项目自有的测试/构建/守卫命令（机器可判定）；真机或人到场项走 DR |
| 7 | **收口** | `wo journal --wo … --who … --what "…"` → `wo table verify --id …`（→ `done`）· `lock release --wo …` · 闭环的 DR/WO/issue 用 `archive move --kind … --id …` |
| 8 | **同步文档** | 决策落地后回改相关文档，再 commit |

### 3.1 需要人做的事（DR）

| 场景 | 做法 |
|---|---|
| 只有项目负责人能定（对外承诺 / 定价 / 合规 / 产品边界 / 破坏性取舍） | `dr add --title … --opt … --recommend N [--blocking]` → 负责人在台账「回填」行答复 → agent 按答复执行 → `archive move --kind dr --id …` |
| 真机验收 / 需要人到场确认 | 同样开 DR，验收清单写**可判定步骤**；agent **不代签** |
| 阻塞级 | `--blocking`（不因超时自动通过）；非阻塞为 `+48h 按默认执行` |

## 4. 面域与写入规则

| 面域 | 含义 | 写入要求 |
|---|---|---|
| **F 自由面** | 单模块内部实现 | 直接改；仍需过测试与构建 |
| **C3 私有受控** | 单项目/单 App 自己的文档与入口 | 责任角色可写；**跨边界影响要开 WO**；重大修订知会主理人 |
| **C2 共享外围** | 跨模块共享的文档/配置 | **WO + 团长（风控）核准 + 串行锁 + 改后当日登记** |
| **C1 全局受控** | 全局契约 / 对外承诺 | 最严：WO + INTENT + 团长核准；破坏性变更**先登记后改** |

判定真源 = `.ai-matrix-team/surfaces.json`；改面域规则本身属 C2。

**白名单写法注意**：`wo new --paths` 与详情单 §2 里的路径**必须含 `/` 或 `*`**；**根级文件（如 `README.md`、`AGENTS.md`）要写成 `*.md` 这类 glob**，否则会被解析丢弃、`check` 报越权（AIM-T issue I-017）。

## 5. AIM-T 更新后，项目必做动作

### 5.1 日常小版本更新

```bash
AIMT=<AIM-T 真源仓绝对路径>
PROJECT=<项目根绝对路径>

# ① 拉真源仓，看版本是否变化
git -C $AIMT pull --ff-only && cat $AIMT/VERSION

# ② 同步"你所在客户端用的那份副本"（若客户端是独立 clone，例：~/.codex/skills/ai-matrix-team）
git -C <客户端副本路径> pull --ff-only && cat <客户端副本路径>/VERSION

# ③ 激活入口巡检（各客户端独立校验）
node $AIMT/scripts/aimatrix-verify-skills.mjs --project $PROJECT

# ④ 升级预检（版本闭环 / 项目档案 / 专家包 / 入口 / 工作区 / 未闭环 BLOCKING DR）
node $AIMT/scripts/aimatrix-preflight.mjs --project $PROJECT --fix

# ⑤ 一键体检（专家包实例一致性 + 仓库自检 + 散件齐全）
node $AIMT/scripts/aimatrix-guard.mjs agents --project $PROJECT

# ⑥ 状态总览（在途 WO / 未闭环 DR / 锁）
node $AIMT/scripts/aimatrix-guard.mjs report
```

正常后：把升级动作写进在途 WO 的 journal，并与本次改动一起 commit（AIM-T 仓自身只提交 AIM-T 侧变化）。

### 5.2 引擎大版本 / 目录结构迁移

```bash
node $AIMT/scripts/aimatrix-migrate-v2.mjs --project $PROJECT --dry    # ① 预演（不写盘）
node $AIMT/scripts/aimatrix-migrate-v2.mjs --project $PROJECT --auto   # ② 确认后执行
```

- **必须显式带 `--dry` 或 `--auto`**（不带模式参数一律拒绝执行，防误触）。
- **迁移前先提交工作区**（否则升级改动与在途改动混在一起，无法 review）。
- 迁移会改 `.ai-matrix-team/` 结构（详情单收拢、台账归一、档案补记引擎版本）→ 迁移后再跑 5.1 的 ③④⑤。

### 5.3 升级后回归清单

1. `guard report` 看有无异常行；
2. 在途 WO 跑 `wo lint <详情单>`；C2 写入前 `check` 必须通过；
3. 若本次升级改了**状态词表 / 取号规则**，在途单据状态值**以工具为准**（例：v0.7.0 起写入需要 `EXECUTING`）；
4. 刷新项目侧文档里的「当前状态快照」（§10 指向的项目流程文档）。

### 5.4 发现 AIM-T 缺陷怎么办（**分情况**，别只在会话里说一句）

**前提认知**：AIM-T 的**真源仓属于维护者**。普通项目/普通用户通常**没有** AIM-T 本地真源目录，也不该直接往里写——所以按下面顺序处理，**agent 自己判断，必要时问用户一句**。

**第 0 步 · 先自查（30 秒）**：确认这真是 AIM-T 的问题，而不是**项目自己的配置错**（`surfaces.json` 写错、白名单写法不对、`.env` 缺键）。若是后者，项目内解决，不要上报。同时记下：最小复现（命令 + 输出）、AIM-T 版本（`cat $AIMT/VERSION` 或副本 `VERSION`）、客户端（Codex / WorkBuddy / Claude）、平台与项目名。

| 情况 | 判据 | 处理 |
|---|---|---|
| **A · 你就是 AIM-T 维护者** | 本机存在 AIM-T 真源仓且你有写权限 | 直接写 AIM-T 仓的问题白板：`cd $AIMT && node scripts/aimatrix-guard.mjs issues add --project $AIMT --title "一句话现象" --source "谁 · 何时 · 复现 · 期望"`，随维护者下一次提交进入版本库（AIM-T 按 `I-NNN` 编号处理） |
| **B · 你不是维护者，但可以代提 GitHub Issue** | 本机 `gh` 已认证（`gh auth status`）且对 AIM-T 仓库有 issue 权限 | **先问用户是否同意代为提交**；同意后：`gh issue create --repo <所有者>/<仓库> --title "…" --body "…"`（正文用下方统一模板） |
| **C · A / B 都不行**（无真源仓 / 未认证 / 仓库不可达 / 用户不同意代提） | — | **给用户一个"点开就能交"的预填链接**（见下），不要让用户自己去翻仓库找入口 |

**统一 Issue 正文模板**（B、C 共用，保证可复现）：

```text
现象：<一句话>
最小复现：<命令 + 输出>
期望：<应该是什么样>
环境：AIM-T <VERSION> · 客户端 <Codex/WorkBuddy/Claude> · 平台 <macOS/iOS/…> · 项目 <仓库名>
影响：<阻塞了什么 / 有无绕过办法>
```

**C 情况的预填链接**（把标题与正文做 URL 编码，用户只需点开确认提交）：

```text
https://github.com/<所有者>/<仓库>/issues/new?title=<URL编码标题>&body=<URL编码正文>&labels=bug
```

> 仓库地址以 AIM-T 仓的 `origin` 为准：`git -C $AIMT remote get-url origin`（换仓库只改这段 URL）。生成后**贴给用户**，一句话说明"点开确认即可提交"。

**无论 A / B / C，都要在本项目留痕**：在项目 `.ai-matrix-team/issues.md` 记一条「已上报 AIM-T（渠道 A/B/C + 编号或链接）」，避免"只在会话里说一句"就丢失；AIM-T 发版后按 5.1 更新副本。

## 6. 三家 agent client 的接入差异

**共同原则**：

1. **真目录 + 只链一个 `SKILL.md` 文件**——不要链整个 AIM-T 仓，否则 9 个岗位技能会被递归扫描并暴露到用户技能列表；
2. **软链一律写绝对路径**（相对路径要相对入口自身目录解析，层级算错即 drift）；
3. 项目技能目录里若出现指向 AIM-T 的 `aimatrix-*` 链接，**直接删掉**；
4. **三家各扫自家目录、互不代扫**：同时用多个客户端就按需各建一条入口。

| 客户端 | 入口 | 发现方式 | 重建方法 |
|---|---|---|---|
| **WorkBuddy** | `.workbuddy/skills/ai-matrix-team/SKILL.md` | 扫描项目 `.workbuddy/skills/` | `mkdir -p .workbuddy/skills/ai-matrix-team && ln -s $AIMT/SKILL.md .workbuddy/skills/ai-matrix-team/SKILL.md`；专家包另跑 `expert-sync.mjs` |
| **Codex** | ① 根 `AGENTS.md` 壳文件（指针 + `<!-- managed-by: ai-matrix-team -->`）② 用户级技能目录（例 `~/.codex/skills/ai-matrix-team/`） | Codex 读项目 `AGENTS.md`；用户级目录里的 `SKILL.md` 作为技能被发现 | 新建/合并根 `AGENTS.md`，写入指向 `$AIMT/SKILL.md` 的指针与 managed-by 标记 |
| **Claude Code** | `.claude/skills/ai-matrix-team/SKILL.md` | 扫描 `.claude/skills/` | `mkdir -p .claude/skills/ai-matrix-team && ln -s $AIMT/SKILL.md .claude/skills/ai-matrix-team/SKILL.md` |
| 中性聚合点（VS Code / Copilot） | `.agents/skills/ai-matrix-team/SKILL.md` | 扫描 `.agents/skills/` | `mkdir -p .agents/skills/ai-matrix-team && ln -s $AIMT/SKILL.md .agents/skills/ai-matrix-team/SKILL.md` |

**校验**：`node $AIMT/scripts/aimatrix-verify-skills.mjs --project $PROJECT`（退出码 0 = 就绪）。注意：该脚本**目前不校验** Codex 的 `AGENTS.md` 入口（AIM-T issue I-018）。

## 7. 新会话开工清单

```bash
AIMT=<AIM-T 真源仓绝对路径>
PROJECT=<项目根绝对路径>

cat $AIMT/VERSION                                   # 1) 工具版本
node $AIMT/scripts/aimatrix-guard.mjs report         # 2) 在途 WO / 未闭环 DR / 锁（别撞别人的活）
node $AIMT/scripts/aimatrix-guard.mjs surface <路径…>  # 3) 判面域
# 4) 需要授权：开单 → 取锁 → 校验
node $AIMT/scripts/aimatrix-guard.mjs wo new --slug <kebab> --level L2 --surface C2 --paths "<glob,…>" --purpose "…"
node $AIMT/scripts/aimatrix-guard.mjs wo lint .ai-matrix-team/runtime/wo-details/WO-….md
node $AIMT/scripts/aimatrix-guard.mjs wo table start --id WO-… --who "<角色#呼号>"
node $AIMT/scripts/aimatrix-guard.mjs lock acquire --wo WO-…
node $AIMT/scripts/aimatrix-guard.mjs check --wo WO-… --paths <路径…>
# 5) 收口
node $AIMT/scripts/aimatrix-guard.mjs wo journal --wo WO-… --who "<角色#呼号>" --what "做了什么 + 验证结果"
node $AIMT/scripts/aimatrix-guard.mjs wo table verify --id WO-…
node $AIMT/scripts/aimatrix-guard.mjs lock release --wo WO-…
```

**开工前 5 条纪律**：① 只读任务不动受控面；② 受控面**无单不写**；③ 一次只做一件事、小步 commit、commit 带 WO 单号；④ 只有人能定的**落 DR**，不自行假设；⑤ 文档**只体现最新状态**、缩写首现写全称。

## 8. 常见坑（通用）

| # | 坑 | 对策 |
|---|---|---|
| 1 | 只 pull 了 AIM-T 真源仓，客户端仍在用旧引擎副本 | **每一份副本都 pull 到同一版本**，并比对 `VERSION`（§5.1 ①②） |
| 2 | 结构迁移脚本不带模式参数被直接执行 | 一律显式 `--dry` / `--auto`；迁移前先提交工作区 |
| 3 | 根级文件写进白名单却判越权 | 白名单 token 必须含 `/` 或 `*` → 根级用 `*.md`（I-017） |
| 4 | WO 置 `EXECUTING` 后写入被拒（旧版） | 升到新版后已允许；遇阻先按 §5.1 更新副本 |
| 5 | 把岗位技能软链进项目技能目录，污染用户技能列表 | 只链 `SKILL.md` 单文件；发现 `aimatrix-*` 链接直接删 |
| 6 | 台账取号日期与本地日期不一致（宿主 vs 客户端） | **以工具产出编号为准**，不要手改号 |
| 7 | 文档写成"修订流水账" | 只写最新状态；历史留痕交给 journal / DR 归档 |
| 8 | AIM-T 报错只在会话里说一句 | 按 §5.4 登记到 AIM-T 仓 `issues.md`，否则永远不会被修 |

## 9. 相关文档（AIM-T 仓内）

| 文档 | 用途 |
|---|---|
| `SKILL.md` | 安装器：接入、升级、体检的权威步骤 |
| `docs/01-charter.md` … `08-portability.md` | 治理规范正文（章程 / 角色 / 共享面 / 决策 / 流程 / 落地 / 平台 / 移植） |
| `docs/index/` | 实操细则（WO 填单须知、评审标准等，先读索引卡） |
| `templates/` | 范本（本文件；项目接入时带入 `.ai-matrix-team/`） |

## 10. 项目侧补充写在哪

本文件**只讲 AIM-T 的通用机制**。项目自己的内容——**本机路径、面域实例、目录与产品约定、项目常用命令、升级动作的项目差异、当前状态快照、项目特有的坑**——写在项目侧的**研发流程文档**里（命名不要带 AIM-T，例如 `docs/workflow.md`），并在其中**引用本文件**。

这样分工的好处：AIM-T 升级时**本文可被整体覆盖**（永远是最新机制），项目补充**不受影响**；两者不会出现双真源。

---

*本范本由 AIM-T 维护。修订请改 AIM-T 仓 `templates/AIM-T-Guide.md`，不要在项目副本上就地修改。*
