# 门禁执行细则（aimatrix-qa 参考）

本文件承载 [`../SKILL.md`](../SKILL.md) 硬步骤的完整细则。**前端改版单**必读 §2、§3、§4。

## 1. 门禁与专属检查项

1. 跑门禁（范围由主理人裁定）：`pnpm -r typecheck` → `pnpm -r test` → `pnpm -r build`。
2. 逐条核对 PRD 的 AC——**可观测项必须有证据**（截图/日志/命令输出），没证据 = 未通过。
3. **专属检查项**（按项目实际替换）：前端变量不含秘密（`pnpm env:check-ignore`）· 矩阵配置过 schema · CORS 走 `sync-origins.mjs`（手改即打回）· 变体隔离断言 · 新 App 未消费 `Entitlement.features` · 公共服务内无 App 业务词。
4. 结论三态：**✅ 放行 / ⚠️ 改后放行（须复检）/ ❌ 打回**（打回写明具体文件与行）。

## 2. 强制验证维度 · 计算后样式值（computed style）

对前端改版单，**必须**用无头浏览器读取**计算后**样式值并断言落在设计令牌上，不得只看源码里的 `var(--x)`。

必核：`border-color`（裸 `border-*` 必须 = `--border`，**绝不能**命中近黑陷阱色 `rgb(26,29,36)` / `#1A1D24` 类 `currentColor` 回落）、`background`/`background-color`、`color`、字号。

取样式值必须等主题过渡结束 ≥1s 后的**静置值**（见 §4），过渡瞬间会读到插值。

## 3. 强制门禁 · 裸边框静态断言

扫 `src/**`：凡出现 `border-{b,t,l,r,y,x,s,e}` 宽度工具类，须同文件/同元素**显式**出现 `border-hairline` 或显式色（`border-color:` / 内联 `style`），否则**告警（P3）/ 阻断（若落入公共外围）**。

目的：全局 `border-color` 兜底移除后，裸 `border-*` 会静默退回 `currentColor` 且无门禁拦截——该断言堵住这个回归。

## 4. 静置值方法论

`body { transition: background-color .18s, color .18s }` 使**主题切换瞬间**的 computed `border-color` 取到**过渡插值**，静置 ≥1s 后归位令牌值。故：

- 直方图 / computed 断言**必须取静置值**，否则会误报「非令牌色」；
- 断言前先 `await page.evaluate(() => new Promise(r => setTimeout(r, 1000)))`，或显式等过渡结束事件；
- 双路主题（`[data-theme="dark"]` 与 `prefers-color-scheme` 暗）都要各取静置值穷举，不得只验一路。
