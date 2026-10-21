# Issues · 未处理事项白板

> **用户随手记**：文末追加 `## 标题` + 一句话即可，编号/状态/去向不必填（缺元数据视为草稿，`guard issues normalize` 自动补）。  
> **agent 一律经命令写入**：`guard issues add|triage|close|normalize`。闭环条目整块移入 `runtime/archive/YYYY-MM.md`。  
> 状态：OPEN（待归类）/ TRIAGED（已开单，去向必填）。

## I-040 guard 无 instances.json 写入口：呼号只能手改，且 callsign 格式陷阱会让「未登记」告警永远消不掉
来源: PC · WO-20261021-03/04 收口实测 10-21 · 状态: OPEN · 去向: — · 更新: 2026-10-21
**事实**：`guard instances` 只读 `runtime/state/instances.json`，但全仓无任何命令写它（`guard role` 只打印可发版说明）。PC 只能手改 JSON，而 `instKey()` 用 `session` 前缀 + `callsign` 拼键：`callsign` 必须写纯数字 `"2"`（session 写 `developer#2 · …`），若按直觉写 `"developer#2"` 会拼出 `developer#developer#2`，`instances` 永远报「未登记」且不提示正确格式——本次收口实测踩中两次。另：手改是整文件重写，容易覆盖他人登记（本次一度覆盖 `developer#1` 历史条目，已恢复）。
**建议**：① 新增 `guard instances add --callsign <角色#N> --wo <id> --session "<描述>"`：读-改-写**按键合并**（复用现成 `instKey()`），撞号拒写并列出冲突单，`session` 前缀由命令自己拼、不让人手写，形态对齐 `dr add`/`issues add`（含 `withLedgerLock` 写锁 + 回读校验）；② `instances` 未登记告警附一行正确格式示例；③ 顺带把 `templates/wo.md` §5 的 grep 示例改 `grep -E`（本机 toybox 的 BRE 不支持 `\|`，照模板写会恒返 0 行假绿）。
**定位**：`scripts/aimatrix-guard.mjs` 中写入口完全缺失——仅 `INSTANCES_FILE()`(L474)、`readInstances()`(L480)、`cmdInstances()`(L646 纯打印)；该文件承载「只增不删」语义却无机器写入口，覆盖丢失属结构性必然（本次已实测覆盖 `developer#1` 历史条目，PC 手工恢复）。

## I-041 wo table done 不回写详情单元数据：状态/执行角色/journal 条数/收口勾选仍停在草稿态
来源: PC · WO-20261021-01~04 收口实测 10-21 · 状态: OPEN · 去向: — · 更新: 2026-10-21
**事实**：`wo table done` 只改活动表并归档表行，详情单 `runtime/wo-details/<id>.md` 全程不回写：`状态` 仍 `DRAFT`、`执行角色` 仍是骨架占位（`角色#呼号` 或默认 `developer#1`）、§9 的 `journal（N 条）· spawn 次数` 不更新、§10 收口清单不勾。结果：表里 DONE、详情单里 DRAFT；本次四单收口后由 PC 手工回写才对齐。详情单在收口提交后仍会被改写，除 journal 手工补记外无机器留痕。
**建议**：`wo table done` 顺带回写详情单四字段（状态=`DONE`、执行角色取表行处理者、§9 journal 条数与 spawn、§10 打勾）；`start|done` 时把详情单纳入台账白名单说明；详情单在提交后仍被改写时 `audit` 应告警（mtime/hash 比对）。

## I-042 WO 白名单解析只收含 / 或 * 或 . 的 token：根级无扩展名文件（如 VERSION）被静默丢弃，check 恒判越权
来源: PC · WO-20261021-05 发版实测 10-21 · 状态: OPEN · 去向: — · 更新: 2026-10-21
**事实**：`scripts/aimatrix-guard.mjs` 的 `parseWo()` 收集 §2 白名单时有一道形态过滤（第 236 行注释「像 glob/路径的 token：含 / 或 *，或根级文件（含 . 扩展名形态）」），判定条件为 `includes('/') || includes('*') || includes('.')`。扩单时写了 `| C2 | \`VERSION\` |`（根级、无扩展名），token 被静默丢弃——`guard check` 打印的白名单只剩后三项，`VERSION` 恒判越权，且**没有任何「白名单项被忽略」的告警**。WO-20261021-05 实测：`wo new --paths "VERSION,.aimt/project.json,..."` 生成的单，`check --wo … --paths VERSION` 报「⛔ 越权」，`lock status` 面域也只剩 1 条。绕法：把该项写成 `VERSION*`（含 `*`）即通过——但绕法本身是隐式知识，写单的人不会知道。
**建议**：① 形态过滤改为「表格单元格一律收」，仅排除表头/分隔行与含中文/空格的说明列（面域列 `C2` 无 `/.*` 已被排除，不必靠启发式）；② 若必须保留启发式，则丢弃项要打一行 `⚠ 白名单项 X 疑似非路径已忽略`，禁静默；③ 补一条回归：白名单含根级无扩展名文件时 `check` 应通过。
