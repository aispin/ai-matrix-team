# 交接单 · WO-20261008-03-preflight-upgrade

**结论**：升级预检一键化已交付——「升级/检查 ai-matrix-team·AIM·专家团」一句话触发，一条命令出三态结论，用户无需知道细节。

**改动**（全部 C2，7 路径）：
- 新增 `scripts/aimatrix-preflight.mjs`（六项检查 → ✅/⚠️/❌ 三态 + 逐项 ↳ 建议；`--fix` 仅补记版本字段）
- 新增 `VERSION`（0.5.0，唯一版本源）；`init.mjs` 档案戳记 engineVersion + --check 比对
- `expert-sync.mjs` TEAM_VERSION 改读 VERSION（生成物版本号不变）
- 触发词词典入 `aimatrix-intake/SKILL.md` + `members/team-lead.md`（含裸词消歧）
- 规格文档 `docs/specs/SPEC-20261008-02-preflight-upgrade.md`

**验证证据**：AC-1~7 全实测（--fix diff 仅一行；9.9.9 假版本双报；同步后预检 ✅①-④）；`dr scan` 无未闭环；wo lint 合规。

**回滚**：`git checkout HEAD -- <四文件> && rm -f scripts/aimatrix-preflight.mjs VERSION`（见 WO §6）

**遗留 DR**：无。

**生效**：触发词词典与专家包更新需重开会话；预检命令即生效。
