# Workorders · 任务表

> **agent 专用**，经 `guard wo table add|start|done|block` 维护。状态：TODO → EXECUTING → VERIFYING → DONE；卡决策 BLOCKED_DR。
> EXECUTING 即锁定（🔒），他单不得触碰。触碰 C1/C2 或验收 L2：「关联」列必挂瘦身详情单 `runtime/wo-details/<单号>.md`（白名单/验证/回滚三字段）。

| 单号 | 任务名 | 简述 | 关联 | 状态 | 处理者 | 锁定 | 更新 |
|---|---|---|---|---|---|---|---|
| WO-20261010-02 | 滞留测试 | sweep 负例 | — | TODO | — | — | 2026-10-10 |
| WO-20261011-02 | 单据v2消费端收敛 | 引擎切三表+wo-details，文档看板同步 | SPEC-20261010-03 | VERIFYING | PC（Codex 代执行） | 🔒 | 2026-10-11 |