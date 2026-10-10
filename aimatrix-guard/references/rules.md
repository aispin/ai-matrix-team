# 面域速记与共享锁规则（aimatrix-guard 参考）

本文件由 [`../SKILL.md`](../SKILL.md) 外移，按需读。

## 3. 面域速记（规则源 `<team-repo>/scripts/surfaces.json`）

- **C1**（共享核心，重单）：`packages/shared-types|llm|config|utils`、`services/**`、根 `package.json`/`pnpm-workspace.yaml`/`tsconfig.base.json`/`matrix.config.schema.json`、`.github/**`、根 `.env.example`
- **C2**（轻单）：其余 `packages/**`、根 `scripts/**`、`infra/**`、根 `docs/**`、`<team-repo>/**`（专家团资产，团队仓自管）
- **C3**（App 私有受控）：`apps/*/matrix.config.json`、`apps/*/.env.example`、`apps/*/docs/**` —— 跨 App 影响才开单
- **F**（自由）：`apps/*/src|packages|scripts|public/**` —— 不开单，QA 门禁照跑
- **T**（台账）：`<project>/.ai-matrix-team/runtime/**` —— 任何角色可写，格式套模板
- **S**（跳过）：`.workbuddy/**`、`node_modules`、`dist`
- 拿不准 → `surface` 查；仍拿不准 → 按 C2 处理（从严）。

## 4. 共享锁规则（按面域分片）

共享锁**按面域分片**：面域不相交的多个 WO 可同时持锁，**同面域（冲突面相交）仍互斥**。holder 的冲突面 = 其白名单在 **C1/C2** 面域的子集（**T/F/S 不计入**）。TTL 默认 240min，过期自动释放（写 `guard.log`）；**面域相交才排队**、不硬抢；紧急热修走 W6 例外（24h 内补单 + 交接单标 `EXCEPTION`）。
