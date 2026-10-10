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
| `nav` | | 导航项 `[{icon,label}]`，与 `pages` 顺序一一对应 |
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
| `kv` | `items:[{k,v}]` |
| `notice` | `text`、`tone` ∈ ok/warn/err、`icon` |

通用可选字段：`title`、`hint`、`ui`（`data-ui="<框架>:<组件名>"` 标注，供开发取用真组件）、`stateCopy`、`emptyAction`、`partialCount`。

## 状态（八态，自动生成）

默认/加载中/空态/错误/无权限/离线/部分失败/超长内容——页内 chips 点击切换，走查用。

- 通用状态均有默认文案；按业务覆盖写该 section（或全局）的 `stateCopy`。
- 空态、错误态自动带行动出口（新建 / 重试）——不写也合规。
- `stats/cards/table/chat/list` 自动给加载骨架；其余类型在该状态下显示同一套通知条。
- 长文案不写死在草稿里：超长态由脚本用标准长串验证截断与滚动。

## 图标

`icon` 取值：grid / chart / users / settings / bell / search / check / alert / lock / wifi / refresh / plus / inbox / file / moon / side。**禁 emoji**（门禁）；需要新图标时在 `aimatrix-render.mjs` 的 `ICONS` 里加线性 SVG。

## 铁律（与 examples 一致）

- 配色只用令牌（`var(--n-*)` / `var(--brand)`），不写死颜色
- 深浅双主题由脚本保证，浅深切换 + 记忆偏好内置
- 视口 375px 无横向滚动；侧栏两段式收起（0 完整 → 1 仅图标 → 2 隐藏）
- 出稿后仍需**比样自检**：与 `examples/` 同场景样例并排比一次

## 样例

`aimatrix-product-designer/drafts/02-dashboard.draft.json`
