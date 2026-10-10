# 07 · WorkBuddy 原生「计划 / 任务 / 转发」能力调研

> 📇 **先读索引卡**：`index/07-workbuddy-native.md`（≤30 行速览 + 按节读取指引，避免整读）。会话卫生纪律：Read 带 offset/limit。


> **回答的问题**：WorkBuddy 自带的「项目功能（计划、任务、转发）」有没有接口可以**创建计划、创建任务、变更任务状态、转发任务**？本专家团该不该用它？
> **调研方式**：静态分析本机 WorkBuddy 内置 CLI 的 OpenAPI 清单（130 条路径）+ 会话 IPC 通道探测 + 本机任务数据落盘格式。
> **结论一句话**：**有「发起 Agent 执行」和「投递消息」的接口，没有「计划/任务 CRUD」的接口**。原生任务是**会话私有的 Agent 工具产物**，不是可编程的项目台账——所以本专家团的 WO / DR 台账**继续以仓库文件为唯一真相源**。

---

## 1. 三问三答（速览）

| 你想要的能力 | 有没有接口 | 实际形态 |
|---|---|---|
| **创建计划（Plan）** | ❌ 没有 REST | 「计划」是**会话内的模式/视图**（Plan 模式 + 步骤列表），不落项目级对象；路径里唯一的 `/api/v1/goal` 只是 ACP 内部代理，**不是计划 CRUD** |
| **创建任务（Task）** | ❌ 没有 REST | 任务由 Agent 的 `TaskCreate / TaskUpdate` **内置工具**创建与变更，落盘成 `~/.workbuddy/tasks/<sessionId>/<id>.json`；对外 REST 只有 `GET /api/v1/tasks/templates`（模板列表）与其刷新 |
| **任务状态变更** | ⚠️ 间接可行 | 只能通过 Agent 自己的 Task 工具改，或手工改上面那个 JSON 文件（**非官方契约**，与内置工具并发会互相覆盖） |
| **转发任务/会话** | ✅ 有等价物，但**不叫转发** | 见 §3：`POST /api/v1/runs`（新起一次 Agent 执行）、`POST /api/v1/sessions/{id}/reply`（向既有会话投递指令）、`POST /api/v1/team/messages/send`（团队成员间发消息）、`/api/v1/jobs/{id}/reply|respawn|stop`（控制智能体实例） |
| **定时任务** | ⚠️ 半套 | `GET /api/v1/scheduled-tasks` 列表、`DELETE /{id}` 删除；**没有创建/修改**接口（创建走客户端自动化配置） |

---

## 2. 能力地图（本机 WorkBuddy 本地 REST 面，节选）

> 来源：内置 CLI bundle（`app.asar.unpacked/cli/dist/codebuddy-lite-wb.mjs`）内的 OpenAPI 定义，共 130 条路径。默认 daemon 地址 `127.0.0.1:9527`（bundle 内 daemon 默认配置），**本次探测时该端口无响应**——桌面端当前会话并不依赖这个 daemon 提供控制面。

| 类别 | 端点 | 方法 | 能做什么 |
|---|---|---|---|
| **Runs（最接近「派任务」）** | `/api/v1/runs` | POST | **发起 Agent 执行**：传 Gateway Protocol 消息 `{text, sender:{id,name}}`，返回 `runId`（202） |
| | `/api/v1/runs/{runId}` | GET | 查询执行状态 |
| | `/api/v1/runs/{runId}/stream` | GET(SSE) | 实时流式输出 |
| | `/api/v1/runs/{runId}/cancel` | POST | 取消执行 |
| **Sessions（对话）** | `/api/v1/sessions` | GET | 会话列表 |
| | `/api/v1/sessions/across-projects` | GET | **跨项目**会话列表（找目标会话用） |
| | `/api/v1/sessions/{id}/reply` | POST | 向会话**投递回复**（不占 ACP writer） |
| | `/api/v1/sessions/{id}/rename` `/replay` | — | 重命名 / transcript 回放 |
| **Jobs（智能体实例）** | `/api/v1/jobs` | GET | 列出智能体实例 |
| | `/api/v1/jobs/{id}` `/name` | GET / — | 详情、重命名 |
| | `/api/v1/jobs/{id}/reply` | POST | **向智能体发后续指令** |
| | `/api/v1/jobs/{id}/respawn` `/stop` | POST | 重拉起 / 停止 |
| | `/api/v1/jobs/{id}/transcript` `/stream` | GET | transcript 立即读取 / 流式回放 |
| | `/api/v1/jobs/dispatch-context` | GET | 获取派发上下文 |
| **Team（团队成员通信）** | `/api/v1/team/messages/send` | POST | `{teamName, recipient, message}` —— 团队内定向发消息 |
| | `/api/v1/team/messages/unread` `/read` | GET / POST | 拉取未读 / 标记已读 |
| **Tasks** | `/api/v1/tasks/templates` | GET | **只读**：任务模板列表 |
| | `/api/v1/tasks/templates/refresh` | POST | 触发 AI 重新推荐模板 |
| **Scheduled tasks** | `/api/v1/scheduled-tasks` | GET | 定时任务列表 |
| | `/api/v1/scheduled-tasks/{id}` | DELETE | 删除定时任务 |
| **其他（本团可能用到）** | `/api/v1/fs/*`、`/api/v1/process/*`、`/api/v1/pty/*` | — | 文件/进程/终端能力（非本项目所需） |

> **未在 REST 面出现的能力**：`TaskCreate / TaskGet / TaskUpdate`（任务工具）、`Agent`（派发子智能体）、`SendMessage`（成员通信）、`Skill`、`cron/自动化`。这些是**会话内工具**，只能在 Agent 运行时被调用，**没有对应的 HTTP 端点**。

---

## 3. 「转发」到底对应什么

UI 上的「转发」不是独立对象，程序化等价物有四条路径，按语义选：

| 你想「转发」的场景 | 用什么 | 备注 |
|---|---|---|
| 把一件事交给**另一个会话**继续做 | `POST /api/v1/sessions/{id}/reply {text}`（先 `GET /api/v1/sessions/across-projects` 找 id） | 目标必须是**当前活动会话**，否则 409 |
| 让一个**智能体实例**接着干 | `POST /api/v1/jobs/{id}/reply {…}` | 实例级，跨 Recommend/Worker 也能打 |
| **新起**一次 Agent 执行（最接近「转成一个新任务」） | `POST /api/v1/runs {text, sender}` → SSE `/runs/{runId}/stream` 收结果 | 异步，`/cancel` 可中止 |
| **团队内部**成员间传递 | `POST /api/v1/team/messages/send {teamName, recipient, message}` | 与 Agent 的 `SendMessage` 工具同源；配合 `/team/messages/unread` 轮询 |

> 若要在本会话内部实现等价效果，直接用 **Agent 工具派子成员** 或 **SendMessage** 即可，不需要 REST。

---

## 4. 原生任务的数据落盘格式（以及为什么不直接写它）

任务文件：`~/.workbuddy/tasks/<sessionId>/<id>.json`

```json
{
  "subject": "分析歌曲结构与情绪曲线",
  "description": "读取 xxx.wav（48kHz 立体声，约185s），做 RMS 能量包络、段落切分与节拍估计…",
  "activeForm": "分析歌曲结构与情绪曲线",
  "status": "completed",          // pending | in_progress | completed
  "id": "1",
  "createdAt": 1790241246134,
  "updatedAt": 1790243323673     // 依赖时另有 blocks / blockedBy 字段
}
```

**为什么本专家团不拿它当台账**：

1. **会话私有**：目录按 sessionId 分桶，换一个会话就看不到另一个会话的任务——而跨会话正是 ai-matrix 最大的痛点。
2. **随会话蒸发/归档**：任务是「当前一轮活儿」的进度条，不是项目资产；仓库里的 WO 会随 git 长期留存、可 code review。
3. **无外部契约**：没有 REST 写入方式，外部写 JSON 会与内置 Task 工具的写操作**互相覆盖**（同文件名覆盖写）。
4. **缺治理字段**：没有「面域 / 锁 / 影响面 / 回滚方案 / 关联 DR」，而这些正是本团门禁的输入。

---

## 5. 对本专家团设计的影响（结论）

| 设计项 | 决定 | 理由 |
|---|---|---|
| **WO / DR 台账形态** | 继续用**仓库 Markdown + 索引文件**（`<project>/.ai-matrix-team/runtime/workorders/`、`<project>/.ai-matrix-team/runtime/decisions/LEDGER.md`） | 唯一可跨会话、可 review、可 CI 校验的载体 |
| **要不要把 WO 镜像成原生任务** | **暂不做**；列为开放项 **D-06**，P3 之后再议 | 镜像 = 两份真相源 + 同步成本（违反 Charter P2）；原生任务无法承载面域/锁/DR 字段 |
| **Agent 执行与协作机制** | 用专家团（Team）+ Agent 派成员 + `SendMessage`，**不依赖 daemon REST** | 这是当前受支持、稳定、随版本演进的路径；REST 控制面需要额外起 daemon 且端口/鉴权随版本变 |
| **进度可见性** | 每轮会话内可以用 Task 工具自己列步骤；**跨会话进度看 `guard report`**（在办 WO / 锁 / DR 一屏摘要） | 让「此刻谁在改共享面」在文件层面可见，而不是藏在某个会话里 |
| **交接（handoff）** | 交接单**落文件**（`<project>/.ai-matrix-team/runtime/handoffs/WO-xxx-handoff.md`），UI 上的「转发」只当作**把这段 Markdown 发给下一个会话**的搬运手段 | 内容才是资产，转发只是信道 |

---

## 6. 开放项 D-06（待创始人定）

| 选项 | 做法 | 代价 | 收益 |
|---|---|---|---|
| **A（建议）· 不集成** | 台账只在仓库；`guard report` 提供一屏摘要 | 无同步成本 | 单一真相源，CI 可校验 |
| **B · 单向投影** | 脚本把活跃 WO 生成一份「今日任务清单」文本，供人工粘到 UI 任务里看 | 只读镜像，无回写冲突 | 在 WorkBuddy 界面里能看到在办事项 |
| **C · 双向同步** | WO ↔ 原生任务双向同步 | 冲突处理复杂（谁先改谁覆盖）· 依赖非官方契约（直接写 tasks JSON） | 界面内可直接改状态 |

> **建议先走 A**：等 W3/W8 真跑起来、确认台账字段稳定后，再评估要不要做 B。

---

## 7. 调研的可复现方式（版本变了照这个重跑）

```bash
# ① REST 面：从内置 CLI bundle 抽 OpenAPI 路径清单
python3 - <<'EOF'
import re
p="/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/cli/dist/codebuddy-lite-wb.mjs"
seen={}
for line in open(p,encoding='utf-8',errors='ignore'):
    for m in re.finditer(r'"/api/v[0-9]+/[^"]+"', line):
        q=m.group(0).strip('"'); seen.setdefault(q,'')
print(len(seen)); [print(k) for k in sorted(seen)]
EOF

# ② 会话 IPC 通道：看当前会话能用什么（本机实测只有 http.fetch）
#    ~/.workbuddy/wbipc/endpoint.json → unix socket + ticket

# ③ 任务数据落盘
ls ~/.workbuddy/tasks/<sessionId>/   # 每个任务一个 <id>.json

# ④ daemon 是否在本机提供 REST 控制面
curl -s --noproxy '*' --max-time 2 http://127.0.0.1:9527/api/v1/health
```

> **局限声明**：以上为对**本机客户端版本**的静态/运行时观测，非官方文档承诺。客户端升级后端点可能变化，第 7 节给出可复现步骤。
