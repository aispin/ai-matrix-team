# 设计稿草稿规格（draft JSON → aimatrix-render 出稿）

阶段三出稿的**默认路径**：模型只写「内容草稿」（JSON），HTML/CSS/SVG/状态样板由 `scripts/aimatrix-render.mjs` 生成。

- 令牌、主题机制、侧栏三态与 `examples/` 同源（设计系统真相源），脚本内联，不引外部依赖。
- 产物仍是**单文件 HTML**（零依赖、双击即开），路径不变：`apps/<app>/docs/design/<场景>-design.html`。
- 模型侧输出仅为草稿字节，实测约为手写稿的 1/8（见 `--stats`）。

## 用法

```bash
node <team-repo>/scripts/aimatrix-render.mjs --in <draft.json> --out <page.html>
node <team-repo>/scripts/aimatrix-render.mjs --in <draft.json> --stats   # 只度量
```

## 顶层字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `app` | ✅ | 应用名（侧栏品牌名、localStorage 键） |
| `pages` | ✅ | 页面数组，至少一页 |
| `title` | | `<title>` |
| `lang` | | 默认 `zh-CN` |
| `nav` | | 导航项 `[{icon,label,group?}]`，与 `pages` 顺序一一对应；`group` 变化处渲染分组小标题 |
| `user` | | 侧栏底部用户块 `{name,role}`（品牌区与用户块对齐 examples 惯例） |
| `seg` / `segActive` | | 顶栏分段控件（如时间范围 `["1h","24h","7d","30d"]`）+ 默认选中下标 |
| `layout` | | 默认应用版式（左侧栏）；`"marketing"` = 落地页版式（隐藏侧栏与收起钮、内容居中 1080px） |
| `youLabel` / `agentLabel` | | 对话气泡署名，默认「你 / Agent」 |
| `stateCopy` | | 全局状态文案覆盖，如 `{"empty":"还没有订单"}` |

## 页面字段

`{ id, title, sections: [] }`

## 组件词汇（section.type）

| type | 字段 |
|---|---|
| `stats` | `items:[{label,value,delta,tone}]`，tone ∈ ok/err/warn |
| `cards` | `items:[{title,text}]`，`cols` ≤4 |
| `table` | `columns:[]`、`rows:[[]]`；单元格可为 `{tag,tone}` / `{mono}` / `{long}` |
| `form` | `fields:[{label,kind,options,placeholder}]`，kind ∈ text/date/select/textarea；`submit` |
| `chat` | `messages:[{role,text,name}]`，role ∈ user/agent |
| `list` | `items:[{text,icon,tag,tone}]` |
| `tabs` | `tabs:[{label,text,items:[{text,icon,tag,tone}],kv:[{k,v}]}]`（页内切换，JS 内建） |
| `raw` | `html:"…"`（逃生舱，见 §表达不了怎么办；每页 ≤1 处） |
| `kv` | `items:[{k,v}]` |
| `hero` | `eyebrow`、`title`、`accent`（品牌色后半句）、`sub`、`ctas:[{label,kind}]`、`meta:[…]`——落地页首屏 |
| `features` | `title`、`sub`、`cols`、`items:[{icon,title,text}]`——特性墙 |
| `compare` | `title`、`before:{title,items:[]}`、`after:{…}`——两栏对比（after 品牌色底） |
| `cta` | `title`、`sub`、`primary`、`secondary`——行动号召条 |
| `notice` | `text`、`tone` ∈ ok/warn/err、`icon` |

通用可选字段：`title`、`hint`、`ui`（`data-ui="<框架>:<组件名>"` 标注，供开发取用真组件）、`stateCopy`、`emptyAction`、`partialCount`。

## 状态（八态，自动生成）

默认/加载中/空态/错误/无权限/离线/部分失败/超长内容——**右下悬浮「状态走查」控件**点选切换（不占页面框架，保持与 examples 一致的版式）。

- 外壳（232px 侧栏 / 60px 顶栏 / 触发钮在最左 / 分段控件 / 品牌与用户块 / 分组标签 / 两段式收起）与 `examples/02-dashboard.html` 同款实现与数值。
- 通用状态均有默认文案；按业务覆盖写该 section（或全局）的 `stateCopy`。
- 空态、错误态自动带行动出口（新建 / 重试）——不写也合规。
- `stats/cards/table/chat/list` 自动给加载骨架；其余类型在该状态下显示同一套通知条。
- 长文案不写死在草稿里：超长态由脚本用标准长串验证截断与滚动。

## 图标

`icon` 取值：grid / chart / users / settings / bell / search / check / alert / lock / wifi / refresh / plus / inbox / file / moon / side。**禁 emoji**（门禁）；需要新图标时在 `aimatrix-render.mjs` 的 `ICONS` 里加线性 SVG。

## 还原示例 vs 省 token：边界（不冲突，但有三条铁律）

**关键事实**：脚本（`aimatrix-render.mjs`，37KB / 564 行）是**一次性成本，且不进模型上下文**——模型只**执行**它、不**读**它。每次出稿的真实成本只有草稿（2.7–5.4KB）。所以「把外壳改成与示例逐字一致」花的是**脚本侧 105 行净增、草稿侧 0 增加**。

| 层 | 还原方式 | 成本落点 | 结论 |
|---|---|---|---|
| **外壳**（布局 / 顶栏 / 侧栏 / 两段式收起 / 令牌 / 交互） | 逐字抄进脚本，一次性 | 脚本 +~100 行；**模型侧 0** | **应 1:1 还原** |
| **通用组件**（表格 / 表单 / 标签页 / 营销区块…） | 组件化，草稿只写字段 | 脚本 +30–80 行/组件 | 按需补齐 |
| **单页特有装饰**（迷你趋势图、条形榜等） | 组件化，或该区块 `raw` | 脚本体积 + 回归面 | **反复出现才组件化** |

**铁律**：

1. **禁止为了「像素级还原示例」而手写整页**（3D / 强定制插画除外）——那会退回 26KB 手写路径，把省下来的 token 全部吐回去。还原的定位是「外壳与约定 1:1，内容与组件等效」。
2. **组件化准入**：同一模式在 **≥2 个场景**出现，或某类 `raw` **反复出现 ≥3 次**，才升级为组件（这正是 P1 landing 区块的由来）。
3. **每次组件化必须让草稿侧更省**：新增组件的草稿字段量 ≤ 手写该区块的 1/5；不满足则用 `raw` 或换组合，不进组件库。

**成本摊薄**：脚本一次性 ~37KB，每次出稿省 ~21–24KB（26.4KB 手写 vs 2.7–5.4KB 草稿）——**约 2 次出稿摊平脚本成本**，之后全是净收益。

## 表达不了怎么办（三级处置）

渲染器是**固定词汇**（上表 10 类），覆盖不了的场景**不许硬塞**，按序选：

| 情形 | 处置 | 成本 |
|---|---|---|
| 内容能用现有组件表达，只是组合方式不同 | 换组件组合（如「看板」用 `cards` + `tabs` 近似） | 低，仍省 token |
| **个别区块**需要定制（特殊图表 / 独特交互） | 该 section 用 **`raw` 局部手写 HTML**（必须走设计令牌 `var(--n-*)`/`currentColor`，每页 ≤1 处） | 中 |
| **整页**形态渲染器表达不了（3D / 强定制插画 / 一次性视觉实验） | **照 `examples/` 同场景手写整页**，比样自检以渲染产物为基线 | 高，但仍是合规路径 |

**硬性保证**：草稿里出现渲染器不认识的组件 → **脚本退出码 1 且不产出文件**，并打印上述三条处置。
因此**不存在「悄悄交出残缺稿」的情况**；设计师永远能交付符合业务需求的 HTML demo——最坏情况是退回手写，能力上限与改造前完全一致（`examples/` 六场景作为风格与结构基准仍在）。

**判断口诀**：能表达 → 渲染（省 8 倍）；差一点 → `raw` 补那一块；差很多 → 整页手写。

## 铁律（与 examples 一致）

- 配色只用令牌（`var(--n-*)` / `var(--brand)`），不写死颜色
- 深浅双主题由脚本保证，浅深切换 + 记忆偏好内置
- 视口 375px 无横向滚动；侧栏两段式收起（0 完整 → 1 仅图标 → 2 隐藏）
- 出稿后仍需**比样自检**：与 `examples/` 同场景样例并排比一次

## 样例

- `aimatrix-product-designer/drafts/02-dashboard.draft.json`（应用版式：统计/表格/表单/tabs/列表/键值）
- `aimatrix-product-designer/drafts/01-landing.draft.json`（营销版式：hero/features/compare/cta）
