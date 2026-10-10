# 汇报与接入引导（aimatrix-intake 参考）

本文件承载 [`../SKILL.md`](../SKILL.md) 的汇报技能与接入新项目两步。**汇报时机**：只在较大特性 / 里程碑收口时读；接入引导只在团队被带进新仓库时读。

## 1. 汇报技能（指挥台模式）

**汇报时机（创始人裁定）**：只在**较大特性 / 里程碑收口**时跑 `aimatrix-report.mjs` 生成新汇报（多单闭环、发布、架构级变更、编制调整）；Express 小迭代收口**不生成**，一句话结论进交接单即可。被动指令（创始人明确要汇报）除外。同一份汇报多次微调重跑 = 违规。

创始人说「汇报工作进展 / 打开仪表盘 / **打开指挥台**」时：

> ⚠️ **术语消歧（硬规则）**：本团队语境里「指挥台 / dashboard / 仪表盘」一律指**本团队仓的 `dashboard/` 操盘台**（127.0.0.1:4780，管线看板 + 汇报页 + 关于团队）。**绝不起 `iskill-pipeline-dashboard`**——那是 ISkills 的通用操盘台技能，与本团队无关；除非创始人明确点名「pipeline dashboard / 操盘台」，否则撞名一律按本节处理。

1. `node <team-repo>/scripts/aimatrix-report.mjs` —— 汇总门禁状态、活跃工单、待拍板、巡检与 git 近况，**用 project.json 的 terms 段 的大白话**（工单/待拍板/占用，不用 WO/DR/lock 术语）生成一份报告，写入 SQLite（`dashboard/data/dashboard.db`），同时在会话里输出文字版。
2. 服务器没起就起一个：`node <team-repo>/dashboard/server/server.mjs`（默认 127.0.0.1:4780），把 **http://127.0.0.1:4780** 给创始人（首页=管线看板 · 汇报页=本次已置顶）。
3. 汇报结构固定四段：**今天干成了什么 → 现在卡在什么（等谁）→ 接下来打算怎么干 → 需要您定的事**。最后一段逐条列出待拍板事项并给出建议默认值。

## 2. 接入新项目（引导）

团队被带进一个新仓库时：

1. 检查 `<project>/.ai-matrix-team/` 骨架齐不齐（缺则按 `<team-repo>/docs/08-portability.md` §5 清单补）。
2. `node <team-repo>/scripts/aimatrix-init.mjs` 扫描落 `<project>/.ai-matrix-team/project.json` → **人工核对面域初判与术语表**（这是唯一的适配点）。
3. `node <team-repo>/scripts/install-to-workbuddy.mjs` 激活 Skill 软链 → `--check` 全绿。
4. 跑一次空巡检出基线，把「规范文档缺失项」立成该项目的第一批待拍板（DR）。
5. 向全员广播项目档案：此后所有成员以 project.json 为初始化依据，**禁止硬编码项目路径**。
