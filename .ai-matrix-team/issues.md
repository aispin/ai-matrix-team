# Issues · 未处理事项白板

> **用户随手记**：文末追加 `## 标题` + 一句话即可，编号/状态/去向不必填（缺元数据视为草稿，`guard issues normalize` 自动补）。  
> **agent 一律经命令写入**：`guard issues add|triage|close|normalize`。闭环条目整块移入 `runtime/archive/YYYY-MM.md`。  
> 状态：OPEN（待归类）/ TRIAGED（已开单，去向必填）。

## I-017 白名单解析只认含 / 或 * 的 token，根级受控文件无法列入 WO 白名单
来源: bobika-dev#1 2026-10-12 在 WO-20261012-08 改根 README.md / AGENTS.md 时踩到：surfaces.json 把两者定为 C2，但 wo 详情单 §2 里的裸文件名（README.md / AGENTS.md）被 parseWo 的 glob 过滤规则丢弃（aimatrix-guard.mjs:「含 / 或 *，且不含空格与中文」），check 直接判越权。当前只能写 *.md 之类 glob 绕过，语义不精确。建议：① 解析时接受根级文件（含 . 且无空格的 token）；或 ② wo new --paths 对无斜杠路径自动补  前缀并成对解析 10-12 · 状态: OPEN · 去向: — · 更新: 2026-10-12

## I-018 aimatrix-verify-skills 不校验 Codex 的 AGENTS.md 激活入口
来源: bobika-dev#1 2026-10-12 建根 AGENTS.md 后跑巡检发现：脚本只扫 .workbuddy/skills、.claude/skills、.agents/skills 三个目录（SKILL_DIRS），而安装器文档把 Codex 的入口定义为项目根 AGENTS.md（壳文件 + managed-by 标记 + 指向团队仓 SKILL.md 的指针）。后果：Codex 入口缺失/漂移不会被巡检发现，退出码仍为 0（'就绪'结论失真）。建议：把 AGENTS.md 纳入校验（存在性 + 标记 + 指针可达） 10-12 · 状态: OPEN · 去向: — · 更新: 2026-10-12
