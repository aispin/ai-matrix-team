# 08 · 可移植性：专家团独立仓与项目接入

> 📇 **先读索引卡**：`index/08-portability.md`。会话卫生纪律：Read 带 offset/limit。

> 目标：**专家团 = 独立 git 仓库**（`ai-matrix-team`），能力可整体接入任何项目——像 ai-matrix 这样的多产品矩阵，接入新项目只需一次引导扫描，不重写任何角色定义。

## 1. 分层：什么跟项目走，什么跟着团队走

| 层 | 内容 | 位置 | 换项目时 |
|---|---|---|---|
| **通用核心**（跟着团队走） | 5 席职责定义（`members/`）、W1–W8 工作流、门禁 CLI 逻辑、巡检 CLI、DR/WO 模板与三件套脚本、汇报生成器、**Dashboard 应用**、init 引导器、expert-sync 打包链 | 本仓 `scripts/`、`dashboard/`、`docs/03/04/05`（机制篇） | **原样复用，不改** |
| **项目适配层**（跟着项目走） | 项目档案 `project.json`、门禁规则 `surfaces.json`、规范文档绑定（BRD/架构/契约…）、术语表、运行台账（WO/DR/巡检历史） | `<project>/.ai-matrix-team/{project.json,surfaces.json,runtime/}`、项目根 `docs/` | **新项目重新生成/由人校正** |
| **规范知识层**（每项目独有） | 各项目的 BRD 标准、架构文档、shared-contracts、部署手册 | 项目根 `docs/` | 各角色 Skill 通过 `project.json.docs` **按文件名发现**，缺失时角色降级运行并在首次汇报中声明 |

核心原则：**角色 Agent 永远不硬编码项目路径**。它开工第一步是读 `<project>/.ai-matrix-team/project.json`；找不到就先跑 `aimatrix-init.mjs` 引导生成。CLI 一律 `--project <root>`（或环境变量 `AIM_PROJECT_ROOT`）。

## 2. 首次引导（scan）流程

```text
①  团队仓就位（clone ai-matrix-team，位置任意）
②  node <team-repo>/scripts/aimatrix-init.mjs --project <project-root>
      ├── 探测 package.json / pnpm-workspace.yaml → 项目名、包管理器、workspace globs
      ├── 枚举 apps/ packages/ services/ → 面域初判（C1/C2/C3/F）
      ├── 按约定文件名匹配 docs/*.md → 规范文档绑定（brd/architecture/shared-contracts/…）
      ├── 扫描 .github/workflows → CI 接入点
      ├── 聚合各子包依赖 → 技术栈档案（vite/react/tailwind/…）
      └── 落盘 <project>/.ai-matrix-team/project.json（含大白话术语表 terms）
③  node <team-repo>/scripts/install-to-workbuddy.mjs --project <project-root>   # Skill 软链激活
④  node <team-repo>/scripts/expert-sync.mjs                                     # 专家包生成/刷新（可选，一次性）
⑤  人工核对：surfaces 初判是否要升级个别路径；terms 术语是否符合项目语感
⑥  PC 按 project.json 向全员广播项目档案 → 专家团就绪
```

`aimatrix-init.mjs --check` 供 CI / W8 巡检用：workspace、docs 绑定或 CI 清单漂移 → 退出码 1，提醒重扫。

## 3. 两仓边界与同步纪律

| 变更类型 | 改哪里 | 跟随动作 |
|---|---|---|
| 角色/流程/规范/脚本/操盘台 | 团队仓 | 团队仓 commit；影响项目侧行为时 bump 项目引用的版本说明 |
| 项目面域/台账/项目档案 | 项目仓 `.ai-matrix-team/` | 项目仓 commit；surfaces.json 与 docs/03 §1 表格同源自检 |
| 成员定义 | 团队仓 `members/` | 跑 `expert-sync.mjs` → validate/register/package + cache 落位 → `guard agents` 体检 |

**hooks 化**：项目侧不 import 团队仓代码，只通过 CLI 边界调用——`package.json` scripts、`.githooks/pre-commit`、CI governance job 全部以 `node <team-repo>/scripts/aimatrix-guard.mjs --project . …` 形式引用；团队仓路径记录在 `<project>/.ai-matrix-team/project.json` 的 `teamRepo` 字段（唯一耦合点）。

## 4. 接入新项目的 Checklist

1. clone 团队仓到本机任意位置
2. `node <team-repo>/scripts/aimatrix-init.mjs --project <root>` → 生成项目档案
3. 人工校正 surfaces / terms / docs 绑定（缺失的规范文档先补骨架或声明降级）
4. `node <team-repo>/scripts/install-to-workbuddy.mjs --project <root>` 激活 Skill 软链
5. `node <team-repo>/scripts/expert-sync.mjs` 生成/安装专家包（首次）
6. PC 开场：向全团队广播项目档案，跑一次空巡检出基线
7. 创建者回答 init 报告中的「待拍板」清单（该项目的第一批 DR）

## 5. 多实例身份与 harness 适配层

同一成员可多并行实例（如多个 Bruce），身份 = `角色#呼号`（`Bruce#1`，序号可复用）；「实例 → 会话」归属由 **spawn 者登记**（WorkBuddy 不暴露该映射，见 07 §2），登记文件 `<project>/.ai-matrix-team/runtime/state/instances.json`（gitignore 运行态）：

```json
[{ "callsign": "Bruce#1", "session": "会话名", "wo": "WO-…", "startedAt": "ISO", "harness": "workbuddy" }]
```

与具体 agent 运行环境相关的代码隔离在 `dashboard/server/harness/` 适配层：

- **契约**：`{ id, label, instances(): [{callsign, session, wo, startedAt, harness}] }`，同步、fail-soft、绝不抛错；
- **铁律**：不能阻塞正常使用——主路径只读登记表；任何探测类扩展必须 async + ≤500ms 超时 + TTL 负缓存，失败静默降级；
- **接入新 harness**（codex / deepseek harness…）：登记条目写 `harness: '<id>'`，新增 `harness/<id>.mjs` 实现同契约；选择用 `project.json.harness.id` 或环境变量 `AIMATRIX_HARNESS`，加载失败自动落 `generic`（只读登记表）。

guard 侧检查：`guard instances`（撞号 / 未登记，WARN 级），report 与 audit 附带提醒。
