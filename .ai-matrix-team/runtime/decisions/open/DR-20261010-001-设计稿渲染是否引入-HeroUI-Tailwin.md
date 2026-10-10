# DR-20261010-001 · 设计稿渲染是否引入 HeroUI+Tailwind 同栈（B2/B3 取舍）

| 字段 | 值 |
|---|---|
| **id** | `DR-20261010-001` |
| 提出者 | PC·team-lead |
| 所属 | WO-BOOTSTRAP |
| **决策类型** | Type 2（可逆） |
| **阻塞级别** | NON-BLOCKING |
| 触发类型 | D3 |
| 提出日期 | 2026-10-10 |
| 期限 | 2026-10-12（NON-BLOCKING +48h 按默认执行） |
| **状态** | OPEN |

---

## 1. 问题（一句话，必须可回答）

设计稿渲染是否引入 HeroUI+Tailwind 同栈（B2/B3 取舍）？

## 2. 为什么需要你

- **我做不了**：目标项目未来采用什么技术栈（HeroUI+Tailwind 还是别的），只有创始人知道；这直接决定「稿↔实现同栈」的收益能不能兑现。
- **不该替你决定**：是否接受**产物从「单文件零依赖」变成「内联 React 运行时（预计 150–300KB）」、以及 CI 从纯 node（数秒）变成需要装依赖与构建——这是对审阅体验与流程成本的取舍。

## 3. 选项

| 方案 | 代价 | 收益 | 推荐 |
|---|---|---|---|
| **A. 维持现状**（脚本自研组件词汇） | 组件能力上限 10 类；稿↔实现靠人工对照 | 单文件零依赖、CI 9s、维护极低 | |
| **B1. 规格对齐**（已落） | 需维护一份映射表；值差异仍需人工判断 | 品牌/圆角已同源；组件与类名可对照搬运；**零依赖不变、CI 不变** | ✅ 采纳 |
| **B2. 同栈真组件**（Vite+React+HeroUI SSR） | 内联 React 的产物 150–300KB；引入构建链与锁版本；CI 变慢；离线可用性下降 | 真 HeroUI 全量组件；「零改名直接搬」；彻底消除稿↔实现走样 | 待目标栈确认 |
| **B3. 常驻渲染服务** | 同 B2 + 进程/端口运维；CI 无法离线跑 | 热渲染快；可做截图视觉回归（低频需求） | ❌ 不推荐 |

**关键事实（用于判断）**：
- 脚本（37KB）是**一次性成本且不进模型上下文**（模型只执行不读）；每次出稿成本只有草稿 2.7–5.4KB。所以 B1 对 token 账**零影响**。
- B2 的收益**不在省 token**（两条路都是「模型只写 JSON」），而在于「开发零改名搬运」。
- 依赖已在仓内（`dashboard/` = HeroUI v3 + Tailwind v4 + React 18 + Vite），B2 不需要新引入生态，只需复用其构建。

## 4. 建议默认值

> 你回一句「按默认」我就直接推进：**B1 已落（映射表 `aimatrix-product-designer/references/portability-map.md`）；B2 在你确认目标项目栈后再评；B3 不做**。

## 5. 不做的后果 / 超时行为

- NON-BLOCKING：48h 无答复 → 按 §4 默认执行，台账标注后可推翻（推翻代价：若后续要做 B2，需补一轮「稿→实现」搬运演练与产物形态调整）。
- 不做 B2 的实际后果：搬运时仍需人工判断**底座色与语义色**（§6 已列 9 项不一致），肉眼颜色会有差。

## 6. 影响面

- **受影响**：设计稿渲染链路（`scripts/aimatrix-render.mjs`）、`aimatrix-product-designer` 的 references、团队仓 CI。
- **不受影响**：目标项目的业务代码、团队仓库的现有零依赖形态、专家包（本决策不动 `members/`）。
- **已发现的不一致（B2 的真实动因）**：稿（examples/渲染器）与 dashboard 之间 —— 品牌三值 + 圆角**一致**；页面底色、次级底、边框、主/次文字、ok/danger/warn、阴影命名与基色**共 9 项不一致**。清单见 `references/portability-map.md` §2。

## 7. 关联文档

`aimatrix-product-designer/references/portability-map.md`（搬运映射与不一致清单）· `references/design-draft-spec.md`（草稿规格与「还原 vs 省 token」边界）· `aimatrix-product-designer/SKILL.md`（阶段三出稿）· `docs/04-architecture.md`（若涉栈约束）

---

## 8. 答复（创始人填写 / 由 Agent 回填原文）

- 答复人：创始人 · 日期：
- 结论：选 ______ ／ 按默认 ／ 其他：______
- 原文：

## 9. 回填记录（提出者关闭 DR 前必填）

- [ ] 结论已写回：`references/portability-map.md` / `design-draft-spec.md` / 代码注释
- [ ] LEDGER.md 已更新（`<team-repo>/scripts/ledger-sync.mjs`）
- [ ] 文件移入 `decisions/closed/`
