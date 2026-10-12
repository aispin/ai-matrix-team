# WO-20261008-01-multi-harness-adapter · 交接单

> 模板：`docs/templates/handoff.md` · ≤15 行

**结论**：多运行环境（harness = Agent 运行环境）适配完成，codex 与 claude-code 已接入操盘台，**QA 放行、准出**。

**改动清单**（面域均 C2）
- 新增 `dashboard/server/harness/codex.mjs`、`claude-code.mjs`
- 改 `harness/index.mjs`：环境标识事前三重拦截（堵路径穿越）+ 登记表路径偏移修复 + 非数组加固
- 改 `dashboard/server/server.mjs`：注入项目根（1 行）
- 改 `docs/08-portability.md §5`、`docs/specs/README.md`（「接新环境」清单，四处口径）
- 新建 `docs/specs/`（规格库，需求+技术设计合一）+ `SPEC-20261008-01`

**验证证据**：15 条验收标准 13 项实测全绿（另 2 项为流程项）；P1 穿越攻击 7 例全拦且零落盘副作用、正常 id 不误杀；P2 真登记表实证两个新适配器读到真实数据；5 端点 ×6 启动方式共 30 次请求全 200；回滚在两种提交状态下实测启服正常。详见 `docs/specs/SPEC-20261008-01-multi-harness-adapter.md §6` 与台账复检报告。

**回滚**：`rm -f <两个适配器>` + `git checkout HEAD -- <index.mjs server.mjs 08-portability.md>`（已提交态用 `git revert --no-commit`）。

**遗留待拍板**
- `DR-20261008-002`（NON-BLOCKING）：门禁 `findWoFile` 误选日志缺陷 → 待开工程维护单
- `DR-20261008-003`（NON-BLOCKING）：`dashboard` 构建门禁不可复现（既有技术债）
- 两项建议合并为一张「团队仓工程维护单」处理
