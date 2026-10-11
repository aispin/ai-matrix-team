# Issues · 未处理事项白板

> **用户随手记**：文末追加 `## 标题` + 一句话即可，编号/状态/去向不必填（缺元数据视为草稿，`guard issues normalize` 自动补）。  
> **agent 一律经命令写入**：`guard issues add|triage|close|normalize`。闭环条目整块移入 `runtime/archive/YYYY-MM.md`。  
> 状态：OPEN（待归类）/ TRIAGED（已开单，去向必填）。

## I-001 单据体系迭代落地（三表骨架 + guard 新命令）

来源: PC·team-lead 10-10 · 状态: TRIAGED · 去向: →WO-20261010-01 · 更新: 2026-10-10

## I-009 wo table add 默认自动取新号、不提示同日未挂牌详情单 → 先 wo new 后补表行仍错位（I-003 症状残留）
来源: 实测 growth 项目：先 wo new 得 WO-20261011-02（生成详情单），再 wo table add 自动取号得 WO-20261011-03（nextWoId 把刚建的详情单也算占用），只能手工把详情单改名为 -03 才对齐。d716e6d 已补 wo table add --id 认领能力，但默认路径既不提示「今日存在未挂牌详情单」也不自动认领 → 机制补齐了、引导没补，用户可见症状与 I-003 相同（详情单号≠表行号） 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11

## I-010 nextIssueId 只扫在册块、不扫归档 → 归档后 issue 编号被复用（重号）
来源: 实测：I-002~I-008 归档后，issues add 重新发出 I-002（与归档内两条 I-002 撞号），本条自身亦被编成复用号。WO 侧同类缺陷已修——nextWoId() 明写「须同时扫表行、详情单与归档，防重号」，issues 侧 nextIssueId(blocks) 仍只看 live blocks 10-11 · 状态: OPEN · 去向: — · 更新: 2026-10-11
