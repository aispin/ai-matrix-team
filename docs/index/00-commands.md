# 索引卡 · 00 命令速查（规则 → 命令）

日常开工只读本卡（≤2KB）。命令一律带 `--project <root>`；退出码 2/3/4/5 = 停。

| 规则（出处） | 命令 |
|---|---|
| 判面域：碰受控面必须先开 WO（03-shared-surface §1） | `guard surface <paths...>` |
| 打开/重启团队操盘台（汇报 + 服务 + 实际地址） | `node scripts/aimatrix-console.mjs --project <root> [--keep] [--no-report]` |
| 受控面写入前校验：白名单 + 面域 + 共享锁（03 §4） | `guard check --wo <id> <paths...>`（`--quiet` 取单行结论） |
| 串行锁：同面域互斥（03 §4） | `guard lock acquire\|renew\|release --wo <id>` |
| 开单：字段齐全、主文件 ≤6KB（charter §4A.8） | `guard wo new --slug <kebab> --level L0\|L1\|L2 [--paths "a/**,b/**"]` |
| 单据格式门禁 | `guard wo lint <file>` |
| 过程叙事只进 journal（charter §4A.8） | `guard wo journal --wo <id> --who <角色#呼号> --what "…"` |
| 收口必产交接单，≤15 行（charter T3） | `guard handoff --wo <id>` |
| BLOCKING DR 当轮通报（02-roles §6）；**DR 单 ≤2.5KB**（只抛背景 3–5 句 · 选项含推荐 · 后果 2–3 句） | `guard dr scan [--wo <id>] [--blocking]`（open 单超限报 ⚠ 并退出码 5） |
| 台账字节与注入面度量（charter §4A.8） | `guard stats` |
| 专家包与真源一致 + 技能 frontmatter 合法（02-roles §6） | `expert-sync.mjs --check`（改动 members/ 后 `expert-sync.mjs` 发版） |
| 合规巡检 13 项（02-roles §6.1） | `inspect.mjs <docs\|entitle\|matrix-config\|migrations\|stack\|services-leak\|open-items\|links\|all>` |
| 汇报（里程碑收口才跑，charter §4A.7） | `aimatrix-report.mjs` |
| 指挥台（术语消歧：非 iskill-pipeline-dashboard） | `dashboard/server/server.mjs` → 127.0.0.1:4780 |
| 台账脱敏红线（DR-20261009-004） | `aimatrix-redact.mjs --scan [--fix]` |
| 设计稿出稿（省 token 默认路径） | `aimatrix-render.mjs --in <draft.json> --out <page.html>` |
| 项目档案新鲜度 / 引擎对齐 | `aimatrix-init.mjs --check` · `aimatrix-preflight.mjs` |
| 实例呼号登记（多实例并行） | `guard instances` |
| 无单写入审计（charter §4A） | `guard audit` |
| 一键体检（角色/技能/软链） | `guard agents` |
| **团队仓自检**：技能 frontmatter / 三层阈值 / references 链接 / 修订痕迹 | `aimatrix-repo-check.mjs`（改完仓库跑一次，退出码 1 = 有违规） |

路径简称：`guard` = `node <team-repo>/scripts/aimatrix-guard.mjs`，其余同理。
**读法**：遇不确定先跑命令看退出码，再决定要不要读治理文档正文（charter §4A.5 按需读）。
