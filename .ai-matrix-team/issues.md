# Issues · 未处理事项白板

> **用户随手记**：文末追加 `## 标题` + 一句话即可，编号/状态/去向不必填（缺元数据视为草稿，`guard issues normalize` 自动补）。
> **agent 一律经命令写入**：`guard issues add|triage|close|normalize`。闭环条目整块移入 `runtime/archive/YYYY-MM.md`。
> 状态：OPEN（待归类）/ TRIAGED（已开单，去向必填）。

## I-001 单据体系迭代落地（三表骨架 + guard 新命令）
来源: PC·team-lead 10-10 · 状态: TRIAGED · 去向: →WO-20261010-01 · 更新: 2026-10-10

## I-002 wo table add 取号按「今日表行数+1」，不看既有最大号 → 同一天重号
来源: 复现：临时副本表内已有 WO-20261011-02，再跑 wo table add 仍发出 WO-20261011-02（表内两行同号）。根因 aimatrix-guard.mjs cmdWoTableAdd：n=rows.filter(startsWith(WO-<date>)).length 后 +1；姊妹函数 nextWoId() 却是「扫表行+详情单+归档取 max」。归档/删行后必然重发号 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-003 wo table add 与 wo new 两套取号逻辑 → 同一单的表行号与详情单号错位，且结果依赖调用顺序
来源: 本会话实测：growth 项目先 wo table add 得 WO-20261011-01，随后 wo new 得 WO-20261011-02（详情单文件名即 WO-20261011-02.md），只能手工改名对齐。若先 wo new 再 wo table add 则两者都是 01 —— 顺序敏感。错位后 check --wo <表行号> 找不到详情单 → 白名单为空 → 全部路径误报「越权」exit 2 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-004 check --paths 不按逗号切分，与 --surfaces 的切分口径不一致 → 误报「越权」退出码 2
来源: 实测：check --paths a,b,c 把整串当成一条路径（提示「白名单：（空）」）并 exit 2 越权；同一轮 lock acquire --surfaces C1,C2 却按逗号切分。解析器（aimatrix-guard.mjs 约 1616 行）只对 --surfaces 做 .split(','),--paths/--opt 收多值但不切逗号，且失败信息与用法错误混淆 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-005 surfaces-default.json 默认升级后，存量项目 surfaces.json 无迁移/漂移检测 → 老项目所有 EXECUTING 单 check 恒失败
来源: 团队仓 47730d9 已把默认 wo.statusesActive 补上 TODO/EXECUTING，但存量项目副本未随之迁移；growth 项目 surfaces.json 仍缺这两项 → wo table start 置 EXECUTING 后 guard check 恒 exit 3「未核准/已结束的单不可写入」。guard agents（一键体检）与 aimatrix-init --check 都不校验 surfaces.json 的 wo 块，漂移无声；副本还残留旧措辞（资深风控师 vs 团长（风控）） 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-006 handoff --wo 仍要求长号 WO-YYYYMMDD-NN-<slug>，与 v2「slug 只进标题、不进单号」冲突
来源: aimatrix-guard.mjs cmdHandoffNew 校验 ^WO-[0-9]{8}-[0-9]{2,3}-[a-z0-9-]+$，短号直接拒绝；而 wo table add / wo new / wo journal / lock 全用短号 WO-YYYYMMDD-NN（nextWoId 注释明写「slug 只进标题，不进单号」）。本会话只能手工在交接单里补长号，交接单文件名与台账单号形态不一致 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-007 issues add 不清理「（当前无未处理事项）」占位行 → 白板同时显示占位与 OPEN 条目
来源: 占位行由 aimatrix-migrate-v2 播种进 issues.md；cmdIssuesAdd 追加条目后占位不动。growth 项目实测：guard issues add 后文件同时含「（当前无未处理事项）」与新的 OPEN 条目，人读会误判为无未处理事项 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-008 wo new --surface 把单一面域写给全部白名单行 → 详情单 §2 面域列与路径真实层级不符
来源: 实测 wo new --slug X --level L2 --surface C1 --paths <7 条混合层级>：生成的 §2 表把 7 条路径全标 C1（实际仅 packages/utils 一条 C1，其余 C2/C3），只能手改。check 走路径匹配故不致命，但 guardian 判级/复核会被这列误导 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11
