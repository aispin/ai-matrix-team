# Issues · 未处理事项白板

> **用户随手记**：文末追加 `## 标题` + 一句话即可，编号/状态/去向不必填（缺元数据视为草稿，`guard issues normalize` 自动补）。  
> **agent 一律经命令写入**：`guard issues add|triage|close|normalize`。闭环条目整块移入 `runtime/archive/YYYY-MM.md`。  
> 状态：OPEN（待归类）/ TRIAGED（已开单，去向必填）。

## I-021 目录改名不覆盖消费端 .githooks/pre-commit → 门禁静默失效（比报错更危险）
来源: 实测（ai-matrix-growth）：改名后 pre-commit 内仍读 $ROOT/.ai-matrix-team/project.json 取 team.repo；node 直接 ENOENT（旧路径报错、新路径 .aimt/project.json 正常返回）。因脚本随后是 [ -f "$GUARD" ] || exit 0，取不到 guard 就当通过 → 提交门禁静默失效。aimatrix-migrate-v2.mjs 的改写范围不含 githooks/ci.yml/project.json（脚本内无相关引用）；建议迁移器一并改写消费端 pre-commit，或至少在 --dry/--auto 输出里检测并告警 10-12 · 状态: OPEN · 去向: — · 更新: 2026-10-12

## I-022 消费端 CI 的 Guard lint ledgers 仍指旧目录+已废弃布局 → 空转
来源: ai-matrix-growth/.github/workflows/ci.yml: FILES=$(ls .ai-matrix-team/runtime/workorders/WO-*.md .ai-matrix-team/runtime/decisions/open/DR-*.md 2>/dev/null || true) —— ①目录已改名 .aimt/；②现行台账布局是 runtime/wo-details/WO-*.md（详情单）与 decisions.md 块，旧 workorders/decisions 目录已非主路径。两条都匹配不到 → FILES 为空 → wo lint 一步什么都不做，CI 看起来绿但没在守门。已在本项目就地改 .aimt/runtime/wo-details/WO-*.md，建议同步 CI/init 模板 10-12 · 状态: OPEN · 去向: — · 更新: 2026-10-12

## I-023 消费端 CI 仍调用已改名脚本 install-to-workbuddy.mjs → CI 必红
来源: ai-matrix-growth/.github/workflows/ci.yml:46 仍调用 node ai-matrix-team/scripts/install-to-workbuddy.mjs --check --project project（点名报错 MODULE_NOT_FOUND，本仓 scripts/ 下该文件确实不存在）；团队仓 v0.6.5 已将其改名 aimatrix-install.mjs。消费端无迁移指引 → 下次 CI 跑必失败。建议：init/check 检测旧脚本名并提示，或提供 deprecation shim 10-12 · 状态: OPEN · 去向: — · 更新: 2026-10-12

## I-024 project.json 路径字段未随改名更新，且 init --check 报「结构一致」检不出
来源: 改名后 <project>/.aimt/project.json 内 team.home/gateRules/runtimeDir 与 surfaces.T 仍写 .ai-matrix-team/...（guard 已硬编码直读 .aimt/，故不致命），但 aimatrix-init.mjs --check 仍输出「仅时间戳差异（结构一致），视为新鲜」。即：口径升级/改名后的存量路径漂移既无迁移也无检测——与既有 I-005（surfaces 默认升级后存量副本无迁移/检测）同族。建议 init --check 增路径口径比对（team.* 指向的目录必须真实存在且等于现行 home） 10-12 · 状态: OPEN · 去向: — · 更新: 2026-10-12

## I-025 专家包实例 8 处漂移 + 源包 settings.json 被 watcher 清理
来源: 在本项目跑 guard agents 体检：CHECK DRIFT 8 处，其中 ✗ 漂移 ai-matrix-team/settings.json，并提示「源包 settings.json 被 watcher 清理，cache 快照 v0.7.0 在（运行时以 cache 为准）」。按团队规矩应改真源 members/*.md 后重跑 expert-sync.mjs；watcher 清源目录这个已知坑需要长效对策（否则每次体检都报漂移，真漂移会被噪声掩盖） 10-12 · 状态: OPEN · 去向: — · 更新: 2026-10-12

## I-026 文档与实现口径不一致：08-portability 说 team.repo 是「唯一耦合点」，实际 guard 硬编码 .aimt 直读
来源: docs/08-portability.md:44 称「团队仓路径记录在 <project>/.aimt/project.json 的 teamRepo 字段（唯一耦合点）」；实际 aimatrix-guard.mjs 的 PROJECT/RUNTIME/CONFIG 全部硬编码 path.join(PROJECT(), '.aimt', ...)，既不读 teamRepo（字段实名 team.repo，也非唯一耦合点），也不读 team.home/gateRules。文档口径会误导消费端实现者 10-12 · 状态: OPEN · 去向: — · 更新: 2026-10-12
