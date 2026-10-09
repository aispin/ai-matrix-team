<!-- 由 <team-repo>/scripts/ledger-sync.mjs 自动维护；手改会被覆盖。改数据请改 DR 文件后重跑本脚本。 -->
# DR 台账（LEDGER）

| id | 提出者 | 所属 WO/App | 一句话 | 类型 | 阻塞 | 状态 | 提出日 | 期限 |
|---|---|---|---|---|---|---|---|---|
| DR-20261008-001 | PC·产研高级总监（主理人） | WO-20261008-01-multi-harness-adapter / 团队仓 dashboard/server/harness/ | 多 Agent 运行环境适配规格是否核准 | Type 2（可逆——改动纯 additive，可 git rm 新增文件 + git checkout 还原） | BLOCKING | ANSWERED | 2026-10-08 | 2026-10-09（BLOCKING，需明示答复） |
| DR-20261008-002 | Bruce·资深研发工程师（经 PC 复核确认） | WO-20261008-01-multi-harness-adapter（发现现场） / 团队仓 scripts/aimatrix-guard.mjs | 门禁 findWoFile 误选 journal 缺陷，何时修 | Type 2（可逆——1 行修复） | NON-BLOCKING | ANSWERED | 2026-10-08 | 2026-10-10（NON-BLOCKING 默认 +48h） |
| DR-20261008-003 | 石头·资深质检工程师（L1 验收发现）· 经 PC 复核裁定 | 团队仓 dashboard/（与 WO-20261008-01 **无因果关系**，本单未触碰） | dashboard 构建门禁不可复现，是否立维护单 | Type 2（可逆——依赖与 lockfile 可重建） | NON-BLOCKING | ANSWERED | 2026-10-08 | 2026-10-10（NON-BLOCKING 默认 +48h） |
