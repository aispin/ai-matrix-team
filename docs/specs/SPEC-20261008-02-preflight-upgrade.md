# SPEC-20261008-02-preflight-upgrade · 升级预检一键化

> 规格库规范见 [`README.md`](README.md)：需求 + 技术设计合一，先文档后编码。

| 字段 | 值 |
|---|---|
| **id** | `SPEC-20261008-02-preflight-upgrade` |
| 关联工单（WO） | `WO-20261008-03-preflight-upgrade` |
| 状态 | `已完成` |
| 主笔 | PC（需求 + 设计 + 实现） |
| 创建 | 2026-10-08 |

**术语（章程 T4）**：**harness** = Agent 运行环境 · **WO** = 工单 · **DR** = 待拍板问题单 · **AC** = 验收标准 · **CLI** = 命令行工具。

## 1. 背景与目标

创始人说「升级 ai-matrix-team / 检查 AIM」撞不进自然语言路由；升级前的六项检查靠临场记得挨个跑。目标：**一句话触发 → 一条命令 → 三态结论**，用户不需要知道细节。

一句话用户价值：**升级前有没有坑，跑一次命令全知道，结论只有三个词。**

## 2. 需求范围

- REQ-1 一键预检：`scripts/aimatrix-preflight.mjs --project <root>` 聚合六项检查，输出三态结论（✅ 可以升级 / ⚠️ 可升级但建议先收口 / ❌ 需先对齐），阻断项各带一条 ↳ 修复建议
- REQ-2 版本号闭环：团队仓根 `VERSION` 为唯一版本源（init 档案戳记 `engineVersion`、expert-sync 包版本、preflight 三处同源）；preflight `--fix` 仅补记档案版本字段，不做全量重扫
- REQ-3 WO/DR 汇报：预检列出在途工单（含状态）与未闭环决策单（区分 BLOCKING）
- Out of Scope：不做自动升级执行（预检只判态，改动仍走 W3 开单）；不探测外部工具版本

## 3. 验收标准

- [x] AC-1 预检对团队仓自身跑通，六项逐一输出、结论为三态之一
- [x] AC-2 `--fix` 后 diff 证明 project.json 仅新增 engineVersion 一行；复跑 ①② 转绿
- [x] AC-3 存在在途工单/未闭环决策单时逐一列出，BLOCKING 单导致结论 ❌
- [x] AC-4 `init --check` 对缺 engineVersion 的旧档案报漂移；结构比对行为与升级前一致
- [x] AC-5 expert-sync 改读 VERSION 后 `--check` 仍通过，生成物版本号不变
- [x] AC-6 触发词（升级/更新/检查 × ai-matrix-team/AIM/专家团）写入 intake 与 team-lead 两处，含裸词消歧规则
- [x] AC-7 VERSION 改假值 9.9.9 → init --check 与预检双双报差异；恢复后一致

## 4. 技术设计

**六项检查**：① 版本闭环（档案 engineVersion vs VERSION）② 项目档案漂移（子进程跑 init --check）③ 专家包漂移（expert-sync --check）④ Skill 软链（install-to-workbuddy --check）⑤ 工作区 git 干净度 ⑥ 在途工单/未闭环决策单（直接扫 `runtime/{workorders,decisions}/open/*.md`，排除 `.journal.md`，正则解析状态字段）。

**三态判定**：有 BLOCKING 决策单 / 漂移 / 版本不一致 → ❌（exit 1）；仅提醒项（在途工单、脏工作区、未闭环非阻塞单）→ ⚠️（exit 0）；全绿 → ✅（exit 0）。

**安全**：预检只读为主；唯一写操作 `--fix` 是单字段 JSON 合并（`{...profile, engineVersion}`），不触碰其他键。子进程调用全部 `execFileSync` + 60s 超时 + 异常兜底为失败，绝不向上抛。

**触发词路由**（intake 与 team-lead 岗位文件同步写入）：「升级/更新/检查」×「ai-matrix-team / AIM / 专家团」→ 跑预检 → 转述结论；裸词命中但上下文有更具体业务对象时按原意图表消歧。

## 5. 兼容与风险

- additive：guard 门禁本体零改动；init 结构比对逻辑零改动；expert-sync 仅版本常量换数据源（生成物不变）
- 旧档案缺 engineVersion → 首次跑预检报「需对齐」，`--fix` 一次补齐，属预期信号而非缺陷
- 回滚：`git checkout HEAD -- <四文件> && rm -f scripts/aimatrix-preflight.mjs VERSION`

## 6. 验证命令

```bash
node <team-repo>/scripts/aimatrix-preflight.mjs --project <项目根>          # 三态结论
node <team-repo>/scripts/aimatrix-preflight.mjs --project <项目根> --fix    # 补记版本字段
node <team-repo>/scripts/aimatrix-init.mjs --project <项目根> --check       # 含版本比对
```

## 7. 关联

- 工单：`WO-20261008-03-preflight-upgrade`（runtime 台账）
- 前序规格：`SPEC-20261008-01-multi-harness-adapter.md`（harness 适配层，本单预检覆盖其健康项）
