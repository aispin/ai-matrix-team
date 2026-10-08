# 06 · 落地手册与专家包规格

> 📇 **先读索引卡**：`index/06-rollout.md`。会话卫生纪律：Read 带 offset/limit。

> 每阶段有**可验证的验收标准**，不允许「文档写完了就算落地」。

---

## 1. 落位总览（两仓布局）

| 物件 | 位置 | 入库? | 说明 |
|---|---|---|---|
| **团队仓（本仓）** | `ai-matrix-team/`（独立 git 仓库） | ✅ | Skill 真相源 `aimatrix-*/`、成员真源 `members/`、治理规范 `docs/`、CLI `scripts/`、操盘台 `dashboard/` |
| **项目薄层** | `<project>/.ai-matrix-team/` | ✅（state 除外） | `project.json`（项目档案：apps/面域/workspace）+ `runtime/{workorders,decisions,handoffs,reviews}` 运行台账 |
| **运行态（锁/日志）** | `<project>/.ai-matrix-team/runtime/state/` | ❌ | 机器写；`lock.json` / `guard.log`（gitignore） |
| **Skill 激活点** | `<project>/.workbuddy/skills/aimatrix-*` → 团队仓 `aimatrix-*` | ❌ | **软链、自动生成、禁止手改**；由 `install-to-workbuddy.mjs` 创建 |
| **专家包（源）** | `~/.workbuddy/plugins/marketplaces/my-experts/plugins/<pkg>/` | ❌ | 由 `expert-sync.mjs` 从 `members/` + 包元数据配置生成，**禁止手改** |
| **专家包（安装快照）** | `~/.workbuddy/plugins/cache/my-experts/<pkg>/<ver>/` | ❌ | WorkBuddy 实际加载处；重装 = cache 落位 + installed_plugins.json 对齐 |

**项目耦合配置化**：团队引擎不写死任何项目路径——项目档案放 `<project>/.ai-matrix-team/project.json`，CLI 一律 `--project <root>`（或环境变量 `AIM_PROJECT_ROOT`）指定项目；hooks 由项目侧 `package.json` scripts / `.workbuddy` hooks 指向团队仓 CLI。

---

## 2. 接入新项目（一次配好）

```bash
# ① Skill 软链激活（幂等；--check 供 CI/W8 巡检，漂移退出码 1）
node <team-repo>/scripts/install-to-workbuddy.mjs --project <project-root>

# ② 项目薄层初始化（project.json 骨架 + runtime 目录）
node <team-repo>/scripts/aimatrix-init.mjs --project <project-root>

# ③ 专家包生成与安装（团队包 + 独立专家包一键同步）
node <team-repo>/scripts/expert-sync.mjs

# ④ 体检
node <team-repo>/scripts/aimatrix-guard.mjs agents --project <project-root>
```

- Skill 默认只链**项目级** `.workbuddy/skills/`（全局加载会污染别的项目；确需 `--user-level`）。
- 遇同名旧副本：报冲突、退出码 2；确认可弃后 `--force`（改名 `.bak-<ts>`，**不直接删除**）。
- **软链不被识别的兜底**：退到单向同步 + 字节比对，仍然**禁止手改目标副本**。

---

## 3. 门禁验收演练（必须真跑，不许纸面通过）

```bash
G="node <team-repo>/scripts/aimatrix-guard.mjs --project <project-root>"
# ① 面域判定
$G surface packages/shared-types/src/index.ts docs/README.md
# ② 无单写入必须被拦（期望退出码 3）
$G check --paths packages/shared-types/src/index.ts
# ③ 开单 → 核准 → 抢锁 → 通过（期望退出码 0）
$G check --wo WO-<date>-<seq>-demo --paths packages/shared-types/src/index.ts
# ④ BLOCKING DR 必须阻塞（期望退出码 4）
$G dr scan --blocking --wo WO-<date>-<seq>-demo
# ⑤ 审计
$G audit --since HEAD~5
```

演练结论写进 `<project>/.ai-matrix-team/runtime/reviews/门禁演练.md`。

---

## 4. 专家包规格（五席 · 由 expert-sync.mjs 生成）

**团队包**（`expertType: "team"`，入口主理人）：

```json
{
  "name": "ai-matrix-team",
  "expertType": "team",
  "agentName": "aimatrix-team-team-lead",
  "teamInfo": {
    "leadAgent": "aimatrix-team-team-lead",
    "memberAgents": ["aimatrix-team-product-designer", "aimatrix-team-developer", "aimatrix-team-qa", "aimatrix-team-devops"]
  },
  "agents": [
    "./agents/aimatrix-team-team-lead.md",
    "./agents/aimatrix-team-product-designer.md",
    "./agents/aimatrix-team-developer.md",
    "./agents/aimatrix-team-qa.md",
    "./agents/aimatrix-team-devops.md"
  ],
  "displayName": { "en": "AI Matrix Delivery Team", "zh": "AI Matrix Team" },
  "profession": { "en": "AI Matrix Delivery Team", "zh": "AI Matrix Team" },
  "categoryId": "02-Engineering",
  "avatar": "avatars/team.png"
}
```

**独立专家包**（`expertType: "agent"`，供项目任务挂载）：`aimatrix-team-team-lead`（PC）、`aimatrix-team-product-designer`（毛毛）。WorkBuddy 项目任务选择器对团队型硬关团队 tab（`hideTeamTab`），独立包是项目内用单角色的唯一通道。

**members 真源字段**（`members/<role>.md` frontmatter）：

```yaml
name: <true-source-name>        # expert-sync 按目标包替换为实例 agentName
description: "一句话能力边界"
displayName: { en: "...", zh: "花名" }
profession: { en: "...", zh: "职业位" }
maxTurns: 80
```

**实施纪律**：
- `settings.json` 必写 `{"agent": "<主理人 agentName>"}`（Team 型丢了它主理人不生效）。
- 打包走官方流程：`validate_expert.py` → `register_expert.py` → `package_expert.py`（`env -u PYTHONPATH`，**禁止手搓 zip**）；expert-sync.mjs 已内置。
- **包内不随 Skills**：成员 MD 里写「必读 Skill：`aimatrix-*`」即可，实际加载走项目级软链。
- 头像统一风格（512×512、PNG、≤500KB）；调度成员时 `name` 与 `subagent_type` 均传 **Agent ID**，禁止用中文花名。

---

## 5. 风险与对策

| 风险 | 表现 | 对策 |
|---|---|---|
| 流程过重，一人公司跑不动 | 每件事都要开单、抢锁，Agent 变慢 | 分层：F 面不开单；C2 走轻单；只有 C1 与部署走全流程。Express 模式默认（charter §4A）。度量「人均打扰量」，超标就放宽 |
| 台账变成新的文档债 | WO/DR 写了没人维护 | 台账**由脚本生成/更新**（`ledger-sync.mjs`），人只写 DR 正文 |
| 门禁被绕过 | Agent 直接改文件不跑 guard | 不追求拦住，追求**可见**：CI `audit` 每次跑，违规在 PR 暴露并记流程事故 |
| 专家包与真源漂移 | 两份副本不一致 | 唯一通道 `expert-sync.mjs`（`--check` 巡检）；禁止手改实例 |
| 团队成员过多导致成本 | 每次任务 spawn 全团 | 按 Workflow 只调度需要的角色（W4 只要 2-3 人；W8 只调 1 人 + 事后开单） |
| 两仓耦合失联 | 团队仓移动/改名后项目侧 CLI 全断 | 项目侧只经 `project.json` 的 `teamRepo` 字段（或 `AIM_PROJECT_ROOT` 反向）解析团队仓路径；`guard doctor` 体检连通性 |
