# Issues · 未处理事项白板

> **用户随手记**：文末追加 `## 标题` + 一句话即可，编号/状态/去向不必填（缺元数据视为草稿，`guard issues normalize` 自动补）。  
> **agent 一律经命令写入**：`guard issues add|triage|close|normalize`。闭环条目整块移入 `runtime/archive/YYYY-MM.md`。  
> 状态：OPEN（待归类）/ TRIAGED（已开单，去向必填）。

## I-011 migrate-v2 的 --help 会直接执行迁移（无 --help/--dry-run）
来源: bobika-dev#1 · 2026-10-12 项目升级 .ai-matrix-team 时踩到：node scripts/aimatrix-migrate-v2.mjs --help 期望看用法，实际对 cwd 项目执行了整库迁移（73 文件改动） 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-012 wo new 不挂牌，且与 wo table add 取号日期源不一致
来源: bobika-dev#1 · 2026-10-12 WO-20261011-01 开单时踩到 · wo new --slug 生成 runtime/wo-details/WO-20261012-01.md 但未在 workorders.md 挂牌；随后 wo table add 开出 WO-20261011-01（宿主日期），两份 id 不一致，只能人工改名对齐。建议：wo new 创建即挂牌，且两处取号共用同一日期源 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-013 dr add 连发取号重复且内容被并入前一条
来源: bobika-dev#1 · 2026-10-12 登记本单两条 DR 时踩到 · 相隔极短的两次 dr add 都返回 DR-20261011-001：第二条 DR 丢失，第一条尾部多出一行「回填」（疑陈旧读/同秒竞态）。重跑才拿到 -002 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-014 wo new --surface 把多面域路径统一标成一个面域
来源: bobika-dev#1 · 2026-10-12 开 WO-20261011-01 时踩到 · --paths 混 C2/C3/F 时，--surface C2 让 §2 面域表全部写成 C2，丢掉 C3/F 区分（面域声明是风控核准依据，失真后果重）。建议按路径自动判面域或支持 路径:面域 语法 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-015 旧结构下 check 把新建详情单判为「已归档」
来源: bobika-dev#1 · 2026-10-12 升级前踩到 · 未迁移结构里 wo new 写入 runtime/wo-details/，紧接着 guard check 报「⛔ WO 已归档：.../wo-details/WO-20261012-01.md」，把新建单说成已归档、引导错误。建议检测结构版本并提示「需先跑 migrate-v2」 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-016 状态词表不一致：wo table start 置 EXECUTING，但 guard check 只认 IMPLEMENTING
来源: bobika-dev#1 · 2026-10-12 开 WO-20261011-01 时踩到：wo table start 把台账置 EXECUTING（并加锁），紧接着 guard check 报「WO 状态为 EXECUTING（需为 APPROVED/LOCKED/IMPLEMENTING/VERIFYING/BLOCKED_DR 之一）→ 不可写入」，即开单后无法写入。
补充（同单复现，定位更准）：工具自身状态机是 **TODO → EXECUTING →（verify）→ VERIFYING → DONE**（verify 在 IMPLEMENTING 下会报「不可 verify」，改回 EXECUTING 才成功）；也就是说 **guard check 的允许集合漏了 EXECUTING**——恰是"正在落码"那个状态被挡在门外。修法建议：check 允许集合并入 EXECUTING（或统一把 start 的落值改为 IMPLEMENTING）。
另：wo table 无「回退（un-start）」命令，只能手改台账。 · 状态: OPEN · 去向: — · 更新: 2026-10-12
