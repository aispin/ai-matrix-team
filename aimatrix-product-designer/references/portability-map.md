# 稿 → 实现 搬运映射（B1 · 规格对齐，不含运行时依赖）

**目的**：开发拿到设计稿后，能按「组件名 + 类名 + 令牌名」**直接搬运**，而不是对着截图重画。本表是 **B1 方案**的交付物——只用规格对齐拿到「同源」收益，**不引入 React / HeroUI / Tailwind 运行时**（产物仍是单文件零依赖）。

> 背景与取舍见决策单：`<project>/.ai-matrix-team/runtime/decisions/`（DR「设计稿渲染是否引入 HeroUI+Tailwind 同栈」）。

## 1. 组件对照（稿里的 `data-ui` → 实现用什么）

| 稿内组件（`section.type`） | `data-ui` 标注 | HeroUI 组件 | dashboard 等价 Tailwind 类（示例） |
|---|---|---|---|
| `stats` | `heroui:Card` | `Card` + `CardBody` | `grid grid-cols-4 gap-4` · `rounded-xl border border-hairline p-4` |
| `cards` | `heroui:Card` | `Card` + `Chip` | `rounded-xl border border-hairline p-4` · `text-xs subtle` |
| `table` | `heroui:Table` | `Table` + `Chip` | `w-full text-sm` · `border-b border-hairline` |
| `form` | `heroui:Input` | `Input` / `Select` / `Textarea` / `Button` | `flex flex-wrap gap-3` · `h-9 rounded-lg border border-hairline px-3` |
| `tabs` | `heroui:Tabs` | `Tabs` + `Tab` | `flex gap-1 border-b border-hairline` · `border-b-2 border-accent` |
| `list` | `heroui:Listbox` | `Listbox` + `ListboxItem` | `divide-y divide-[var(--border)]` |
| `chat` | `heroui:Card` | `Card` + `Avatar` | `flex gap-2.5` |
| `kv` | — | `Descriptions`（社区版可用 `dl`） | `grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-sm` |
| `notice` | — | `Alert` | `flex gap-2 rounded-lg border px-3 py-2.5` |
| `hero` / `features` / `compare` / `cta` | `heroui:Card` 等 | `Card` + `Button` | 营销版式按 Tailwind 直接写（`text-[40px] tracking-[-0.02em]` 等） |
| 外壳（侧栏 / 顶栏 / 状态走查） | — | `Tabs`（分段）/ `Button`（图标钮） | `flex h-screen flex-col md:flex-row` · `sticky top-0 h-[60px] border-b border-hairline` |

**搬运三步**：① 在稿里找区块的 `data-ui="<框架>:<组件名>"` → ② 用同名 HeroUI 组件替换 HTML 骨架 → ③ 按 §2 把令牌名换成 dashboard 的语义名。

## 2. 令牌对照与不一致清单（B1 的核心）

**一致（可直接搬）**：

| 语义 | 稿（examples/渲染器） | dashboard | 结论 |
|---|---|---|---|
| 品牌主色 | `--brand #3B5BFD` | `--accent #3B5BFD` | ✅ 值同，仅改名 |
| 品牌 hover | `--brand-h #2F4CE0` | `--accent-deep #2F4CE0` | ✅ 值同 |
| 品牌浅底 | `--brand-bg #EEF1FF` | `--accent-soft #EEF1FF` | ✅ 值同 |
| 圆角 | 12px（组件内写值） | `--r-2 12px` | ✅ 值同 |

**不一致（搬运时必须人工判断，或按 DR 结论统一）**：

| 语义 | 稿 | dashboard | 差异 |
|---|---|---|---|
| 页面底色 | `--n-50 #f8f9fb` | `--bg-top #F3F5F9` | ✗ 底座色不同（dashboard 为「冷静灰」定案） |
| 次级底 | `--n-100 #f1f3f7` | `--surface-2 #F2F4F8` | ✗ |
| 边框 | `--n-200 #e4e7ee` | `--border #DEE3EC` | ✗ |
| 主文 | `--n-900 #12161d` | `--text #1A1D24` | ✗ |
| 次文 | `--n-600 #4a5262` | `--text-2 #5B6270` | ✗ |
| 成功 | `--ok #12855f` | `--ok #047857` | ✗ |
| 危险 | `--err #c0392b` | `--danger #DC2626` | ✗ 名与值都不同 |
| 警告 | `--warn #a86a00` | `--warn #B45309` | ✗ |
| 阴影 | `--sh-sm / --sh-md`（基色 rgba(18,22,29)） | `--sh-2 / --sh-3`（基色 rgba(28,25,23)，暖基色遗留） | ✗ 名与基色都不同 |

**结论**：品牌与圆角已同源；**底座与语义色不一致**——这意味着「即使类名对得上，肉眼颜色也会有差」。要彻底消除，必须选定一处真相源（DR 待拍板），本表只负责把差异**显式列出**，让搬运时有据可依。

## 3. 可搬运率（B1 的验收指标）

以 1 个区块为单位统计开发需要改动的地方：

| 组件 | 骨架改造 | 令牌改名数 | 估计改动 |
|---|---|---|---|
| `stats` / `cards` / `notice` | 换 HeroUI 组件 | 2–3 处 | 小（≤10 行） |
| `table` / `list` / `kv` | 换组件 + 列定义 | 3–4 处 | 中 |
| `form` / `tabs` | 换组件 + 受控状态 | 3–5 处 | 中 |
| 外壳（侧栏/顶栏/收起/主题） | 已有同款实现，可直接对照 | 4–6 处 | 中 |

> **B1 的收益边界**：骨架与交互能对照搬运（省掉「看图猜结构」），但**值差异要靠 §2 决策解决**。若要「零改名、直接搬」，需要 B2（同栈运行时）——见 DR。

## 4. 边界与铁律

- 本方案**不引入任何运行时依赖**：产物仍是单文件、双击即开、零依赖；生成仍是「一次 node 调用」（~0.1s）；CI 仍为纯 node（数秒）。
- 稿里**只标注、不内联** Tailwind 类名（产物带 `data-ui`，需要类名对照时看本表）——避免产物里塞入与实现无关的类名噪声。
- 任何「为对齐实现而改变稿的视觉」的动作（如换底座色）必须先落 DR，不许在稿里私自改色。
