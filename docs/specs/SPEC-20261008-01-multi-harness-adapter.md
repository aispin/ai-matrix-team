# SPEC-20261008-01-multi-harness-adapter · 多 Agent 运行环境适配

> 规格库规范见 [`README.md`](README.md)：需求 + 技术设计合一，先文档后编码。

| 字段 | 值 |
|---|---|
| **id** | `SPEC-20261008-01-multi-harness-adapter` |
| 关联工单（WO） | `WO-20261008-01-multi-harness-adapter` |
| 关联待拍板（DR） | `DR-20261008-001`（本规格核准）· `DR-20261008-002`（门禁缺陷） |
| 状态 | `已核准并已实现`（AC-14：DR-20261008-001 于 2026-10-08 12:31 答复方案 A 后开始编码；实现完成，QA 复检中） |
| 主笔 | 毛毛·资深产品设计师（§1–§3）· Bruce·资深研发工程师（§4–§6）· PC 合稿 |
| 创建 | 2026-10-08 |

**术语（章程 T4，全文不裸用缩写）**：**harness** = Agent 运行环境（成员实际干活的工具，如 WorkBuddy / codex / claude code）· **WO** = 工单（有编号的任务单）· **DR** = 待拍板问题单 · **AC** = 验收标准 · **CLI** = 命令行工具 · **glob** = 通配路径模式。

---

## 1. 背景与目标

### 1.1 为什么现在必须做

- 团队那套治理能力本来是「跟工具无关的」：门禁命令行工具、操盘台（本地 dashboard）、巡检脚本都不挑成员跑在哪个工具里。但今天真正跑通的只有 WorkBuddy 这一条链路——看板只认得出登记为 WorkBuddy 环境的成员实例。
- 一旦有人在 codex 或 claude code 里接活，他就从看板上「消失」：看不到他在忙哪一单工单，也看不到他有没有踩红线。治理出现盲区，门禁等于没守。
- 现在补，成本最低：适配层已经把「跟具体运行环境相关的代码」隔离在一个目录里，接新环境不用动看板主逻辑；趁第二个环境进来之前把规矩固化，比将来三个四个环境各写一套便宜得多。

### 1.2 一句话用户价值

**创始人在 codex 或 claude code 里派出去的成员，操盘台上照样看得见他在忙哪一单——换工具不等于失去治理。**

### 1.3 「同时适配支持多个 agent」到底指什么

这句话有两种读法，不澄清就会两种各做一半。判定如下：

| 读法 | 含义 | 判定 |
|---|---|---|
| 读法一 · 支持多种运行环境并存 | 同一个项目里，不同成员分别跑在 codex / claude code / WorkBuddy 上，都要接得住 | **本次核心，必做** |
| 读法二 · 同一环境里多实例并行 | 同一个环境里同时挂着多个「角色#呼号」实例 | **现状已有能力**，本次不新建，作为回归口径保住 |

还有一种容易混进来的边界：「同一张看板同一时刻汇聚来自多个环境的实例」。判定：**本次只做到最小可用**——复用既有的「通用（仅登记表）」兜底视图即可一次看全部条目，不新建界面、不改看板主逻辑；把它升级成常态化默认视图（按环境分组、加环境筛选器）属于新增诉求，另开迭代。

> **判定结论**：本次做的是**读法一**；读法二以回归条款保住；混合视图只取兜底最小可用。

## 2. 需求范围

### 2.1 需求项（3 条）

**REQ-1 认得出：把 codex 与 claude code 两套运行环境接进操盘台**

- 做什么：新增两个运行环境适配器；登记某位成员时把「环境」字段写成 `codex` 或 `claude-code`，该成员就能在自己环境的专属视图里被筛出来，且看板上带一个人类可读的环境名。
- 验收口径（定性）：以「登记一条某环境的实例 → 请求看板状态 → 断言返回的环境标识与实例列表符合预期」来判定，不靠肉眼觉得「好像出来了」。

**REQ-2 接得动：接入第三个运行环境 = 加一个文件 + 填一个字段**

- 做什么：把「怎么接一个新环境」固化成可照抄的清单（一个适配器文件 + 登记表里写环境标识），写进 `docs/specs/README.md` 与 `docs/08-portability.md §5`；本次的两个适配器就是这个清单的实证样板。
- 验收口径（定性）：照清单接一个新环境的改动面 ≤ 1 个新增文件 + 1 行登记；看板主逻辑、门禁命令行工具、适配层以外的既有文件一律不动。

**REQ-3 塌不了：任何单点失败都不许把看板搞挂**

- 做什么：环境标识写错、适配器文件缺失、登记表损坏或不存在——一律静默退回「看全部条目」的兜底视图，不报错、不白屏、不拖慢。
- 验收口径（定性）：每一种失败各注入一次，断言看板仍正常返回、实例列表仍是合法数组（取不到即为空数组）。

### 2.2 本次不做（明确 Out of Scope）

1. **不自动探测「实例在哪条会话里」**：不去读 codex / claude code 的进程表、日志文件、本地数据库或 socket 来反推归属。理由：跨环境不可靠、有隐私与性能成本，且违反「主路径只读登记表，任何探测必须异步且限时」的铁律。本次一律靠登记。
2. **不改操盘台界面与主逻辑**：不加筛选器、不加环境分组、不做视觉改版；混合视图只复用既有兜底。（若创始人要求把混合视图做成常态化默认，属新增需求，另开迭代。）
3. **不做跨环境的身份合并 / 撞号仲裁**：不判断「两个环境里的 Bruce#1 是不是同一个人」，维持现状的警告级提醒。
4. **不动项目接入引导器**：不要求 `aimatrix-init` 自动生成环境字段（技术章节结论 ⑤ 已判定不改）。
5. **不涉及对外发布、权限、计费、多机同步、会话消耗统计口径**：操盘台是本地工具，非对外产品。

## 3. 验收标准

> 每条一句话，可由命令或观察结果直接判定；打勾才算过，不接受「基本可以」。

**REQ-1 · 认得出**

- [ ] AC-1 指定环境为 `codex` 时，操盘台解析到的运行环境标识（`harness.id`）等于 `codex`，而不是兜底值 `generic`。
- [ ] AC-2 指定环境为 `claude-code` 时，同上，等于 `claude-code`。
- [ ] AC-3 两个新环境各自返回的实例列表，只包含登记表里环境字段对得上的条目，不含其他环境的条目。
- [ ] AC-4 两个新环境各自的展示名（`harness.label`）非空，且与既有的「WorkBuddy」「通用（仅登记表）」不重名。
- [ ] AC-5 登记表里环境字段**缺失**的实例，在 WorkBuddy 视图中仍被算作 WorkBuddy——兼容既有写法，不要求补历史数据。

**REQ-2 · 接得动**

- [ ] AC-6 完整接入一个新环境的改动面 = 1 个新增适配器文件；除此外本次没有任何既有文件被修改（以本次提交的 git 变更清单判定；`index.mjs` 的改动须经待拍板 P1 单独核准并单列）。
- [ ] AC-7 照清单加一个名字自取的假环境后看板能解析它；删掉该文件再用同一配置启动，自动退回兜底视图且不报错。
- [ ] AC-8 `docs/specs/README.md` 与 `docs/08-portability.md §5` 中「如何接新环境」的步骤，与本次两个适配器的实际写法四处口径一致：文件名、登记表字段名、加载失败时的降级方式、环境标识命名规则。

**REQ-3 · 塌不了**

- [ ] AC-9 环境标识写成不存在的名字（如 `nope`）时，解析结果为兜底视图 `generic`，且全程不抛未捕获异常。
- [ ] AC-10 登记表文件缺失时，实例列表返回空数组 `[]`，看板接口仍正常返回 200。
- [ ] AC-11 登记表内容为坏 JSON 时，同上：返回空数组，看板可正常打开。
- [ ] AC-12 同一环境下登记 3 条不同呼号的成员实例时，列表完整返回 3 条、不重不漏（回归条款，守住「同一环境多实例并行」这一种读法）。
- [ ] AC-13 上述任一失败场景下，看板状态接口单次响应耗时不超过正常场景（同机冷启动后首次请求）的 1.5 倍，且不得出现卡住等待。

**文档与流程**

- [ ] AC-14 本规格文档经待拍板流程（DR）由创始人核准后方可进入编码——未核准不得写第一行代码。
- [ ] AC-15 全文无裸用行业缩写：harness / WO / DR / AC / CLI 首次出现处均附中文释义（章程 T4）。

## 4. 技术设计

> 本节结论全部在 `/tmp` 隔离环境实测过（探针已删除），未向团队仓写入任何代码文件。

### 4.1 现状（实测）

| 项 | 现状 |
|---|---|
| 适配层 | `dashboard/server/harness/`：`index.mjs`（入口）+ `generic.mjs`（兜底）+ `workbuddy.mjs` |
| 解析入口 | `resolveHarness(preferred)`：`preferred` → 环境变量 `AIMATRIX_HARNESS` → `workbuddy` |
| 调用时机 | `server.mjs:38` **顶层 await，进程启动时解析一次**；每请求只调 `HARNESS.instances()` ← 这条决定了性能口径（见 §6 V5） |
| 面域 | `dashboard/server/harness/*.mjs` = **C2**（guard surface 实测：未匹配规则 → 按 `defaultTier` 从严判 C2） |
| 契约 | `{ id, label, instances(): [{callsign, session, wo, startedAt, harness}] }`，同步、fail-soft、绝不抛错 |

### 4.2 六项关键结论

**① 实例 ↔ 会话归属 → 登记制，不探测。** codex 与 claude-code 都是本地命令行工具，每次启动一个隔离会话，二者均不对外暴露「实例在哪个会话」的查询接口。三个选项的代价：

| 方案 | 代价 | 结论 |
|---|---|---|
| 登记制（沿用现 workbuddy 写法） | spawn 者忘了登记就看板看不见；由 `guard instances` 的 WARN 兜底 | **采纳** |
| 探测（读 `~/.codex/sessions`、claude 的 jsonl 会话日志） | 内部格式无版本承诺→随时失效；等于把聊天正文喂进看板（隐私）；违反「主路径同步只读登记表」铁律 | 否 |
| 混合 | 需异步 + 500ms 超时 + TTL 负缓存，本次无收益，且违反需求 out-of-scope #1 | 否 |

**② 多 harness 并存 → 不新增聚合能力，复用既有兜底视图。** `resolveHarness` 返回**单个** harness，`pipeline()` 输出 `{harness:{id,label}, instances}`，天然是单环境视图。全量视图无需新代码——`AIMATRIX_HARNESS=generic` 就是「看全部条目」。故不必改 `dashboard/server/server.mjs`（该文件既不在本次主路径，也属需求 out-of-scope #2）。代价：全量视图内各环境条目不分组；但每条自带 `harness` 字段，将来前端要分组不必动服务端。

**③ 可扩展架构 →「约定即注册」（目录自动扫描），不用清单登记表。**

| 选型 | 改动面 | 能否满足 AC-6 / AC-7 |
|---|---|---|
| 注册表（清单文件，新增 harness 要登记） | **2 个**（新文件 + 改清单） | 违反 AC-6「≤1 个新增文件」；清单还会与目录漂移 |
| **约定即注册（有 `<id>.mjs` 即存在）** | **1 个** | 符合 AC-6；删文件即自动退回兜底，天然满足 AC-7 后半 |

实测 `readdirSync(harnessDir)` 扫得 `['generic','workbuddy']`。额外收益：扫描顺手产出**枚举白名单**，一并解决下方 ④ 的路径穿越——一石二鸟。代价：无法为某个环境单独禁用（本地工具无此诉求）；启动时一次 `readdirSync`，微秒级。

**④ 路径穿越 → 缺陷属实，必须事前拦截（三重保险）。** `resolveHarness` 用 `` import(`./${id}.mjs`) `` 拼路径，id 来自环境变量或项目配置。**已实证**：设 `AIMATRIX_HARNESS=../../../scripts/aimatrix-init`，`import()` 真的加载并**执行**了 `<团队仓>/scripts/aimatrix-init.mjs` 的全部顶层代码——它在当前目录下写了一份 `project.json`。最终虽因「契约不符」降级 `generic`，**但副作用已发生、不可撤回**。

关键认知：现有契约校验（`typeof instances === 'function'`）是**事后**的，挡不住**执行时**的副作用。所以拦截必须放在 `import()` **之前**：

```js
const ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;                 // ① 正则：拒 ../ 、. 、/ 、大写、超长
const listIds = (dir) => fs.readdirSync(dir)               // ② 枚举：必须真有一个 <id>.mjs
  .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs').map((f) => f.slice(0, -4));
const isLoadable = (id, ok) =>                              // ③ 保险杠：规范化结果必须落在目录内
  ID_RE.test(id) && ok.includes(id) &&
  path.resolve(DIR, `./${id}.mjs`) === path.join(DIR, `${id}.mjs`);
```

实测 9 例：`../../../scripts/aimatrix-init`、`../../server/server`、`Codex`、`wo/../..`、`.`、`index` → **全部拦截**；`workbuddy` / `generic` → 放行。此修复要改 `index.mjs`，涉及改动既有文件，故列为待拍板 P1（见 §7）。

**⑤ `scripts/aimatrix-init.mjs` → 不改。** 理由：(a) `resolveHarness` 已有三级默认值链，缺 `harness.id` 落到 `workbuddy`，行为完整；(b) `project.json` 本就由人校正（面域、术语、文档绑定同理），多一字段不减人工；(c) init 属 C2，改它要扩白名单，且会让所有已生成档案在 `init --check` 下判为漂移；(d) 需求 out-of-scope #4 明列不提此要求。要用 codex，直接在 `project.json` 加 `"harness": {"id": "codex"}` 即可（注意 `--force` 重跑 init 会冲掉，属已知使用约定，写进 §8 文档即可）。

**⑥ 降级与兼容 → 全部沿用既有 fail-soft，既有适配器零影响。** 六个失败场景的完整降级矩阵与实测结果见 §5.2。

既有 `workbuddy` / `generic` **不受影响**：新适配器与其是同一个过滤公式换了个 id，`(i.harness || 'workbuddy') === id` 语义一字不变，历史缺字段数据仍算 WorkBuddy（兼容 AC-5）。另发现一处健壮性缺口：登记表顶层**非数组**时（如内容为 `"str"` 或 `{"a":1}`），`readInstancesFile()` 原样返回会让 `.filter` 抛 `TypeError`，现靠 `server.mjs` 外层 try/catch 兜住；建议顺手加一行 `Array.isArray` 加固。

### 4.3 文件清单与数据结构

| 文件 | 动作 | 面域 | 说明 |
|---|---|---|---|
| `dashboard/server/harness/codex.mjs` | **新增** | C2 | codex 适配器 |
| `dashboard/server/harness/claude-code.mjs` | **新增** | C2 | claude-code 适配器 |
| `dashboard/server/harness/index.mjs` | 改（仅加 id 校验，见待拍板 P1） | C2 | 契约加固，对外签名不变 |
| `docs/specs/README.md` | 已建，按需补 | C2 | 「接新环境」清单 |
| `docs/08-portability.md §5` | 改 | C2 | 补环境标识命名规则，对齐 AC-8 |
| `scripts/aimatrix-init.mjs` | **不改** | C2 | 见结论 ⑤ |
| `dashboard/server/server.mjs` | 仅当待拍板 P2 核准 | C2 | 注入项目根以修登记表路径偏移 |

登记表条目结构不变（additive）：`{ callsign, session, wo, startedAt, harness }`，`harness` 缺省视为 `workbuddy`。

**白名单口径修正（PC 于 2026-10-08 已处理）**：工单 §2 原写 `dashboard/server/harness/<id>.mjs`，而门禁的 `globToRe` 把 `<` / `>` 当**字面量**处理 → 只匹配字面文件名 `<id>.mjs`，导致 `index.mjs` / `codex.mjs` / `claude-code.mjs` / `docs/08-portability.md` 四条 `check` 全被拦（exit 2）。已把该行改为 `dashboard/server/harness/*.mjs` 并新增 `docs/08-portability.md` 一行，实测六条路径（含 `server.mjs`）**全部转绿**；锁已续期。

### 4.4 关键骨架（仅示意，非实现）

```js
// dashboard/server/harness/codex.mjs —— 两个新文件结构完全一致
export default {
  id: 'codex',                                           // 另一个为 'claude-code'
  label: 'Codex',                                        // 非空，与「WorkBuddy」「通用（仅登记表）」不重名
  instances() {                                          // 同步、fail-soft
    try { return readInstancesFile().filter((r) => r && typeof r === 'object' && (r.harness || 'workbuddy') === 'codex'); }
    catch { return []; }                                 // 顶层非数组时不抛
  },
};

// dashboard/server/harness/index.mjs —— 仅示意新增部分（事前拦截）
export async function resolveHarness(preferred) {
  const id = preferred || process.env.AIMATRIX_HARNESS || 'workbuddy';
  if (isLoadable(id, listIds(DIR))) {                     // ← 新增：结论 ④ 的关键三行
    const mod = await import(`./${id}.mjs`);
    if (mod.default?.instances instanceof Function) return mod.default;
  }
  return (await import('./generic.mjs')).default;         // 任一步失败 → 兜底，不抛
}
```

### 4.5 影响面

仅本地操盘台（127.0.0.1:4780）的实例看板。**无需重新部署、无需重构建**：适配层是服务端模块，`dashboard/dist` 是前端产物、不参与打包；无运行时行为变更、无跨域（CORS）、无密钥轮换。

## 5. 兼容与风险

### 5.1 additive 非破坏论证

1. **不删不改语义**：只新增两个文件；`index.mjs` 仅**新增前置判断**，不收敛原有行为空间——原先能加载的 `workbuddy` / `generic` 依旧放行（实测 ✅）。
2. **对外签名零变化**：`resolveHarness(preferred)` 与 `{id, label, instances()}` 契约一字未改，`server.mjs` 无需感知。
3. **默认值链不变**：无配置 → `workbuddy`，与今日完全一致；老数据缺 `harness` 字段仍算 WorkBuddy（AC-5）。
4. **无侵入依赖**：不引入任何第三方库，Node 22 原生直跑。

### 5.2 降级路径与回滚

| 注入故障 | 期望 | 实测 | 对应 AC |
|---|---|---|---|
| 未知 id / 适配器文件被删 | 静默落 `generic`，不抛异常 | ✅ | AC-7 · AC-9 |
| 登记表缺失 | `[]`，接口仍 200 | ✅ | AC-10 |
| 登记表坏 JSON | `[]`，接口仍 200 | ✅ | AC-11 |
| 同环境 3 条不同呼号 | 完整返回 3 条，不重不漏 | ✅ | AC-12 |
| id 含 `../` 等非法字符 | **事前拒绝**，不进 `import()`，无副作用 | ✅ 9/9 | 安全加固 |
| 单次响应耗时 | ≤ 正常 1.5x | ✅ **1.00x**（26ms / 26ms） | AC-13 |

回滚 = 删新增文件 + 还原**全部**被改文件（质检复核：`server.mjs` 第 24 行导入了 `setProjectRoot`，漏还原它会导致旧版 `index.mjs` 没有该导出，服务启动即 `SyntaxError`）：

```bash
# ① 删新增（用 rm 而非 git rm：未提交态下 git rm 不认未跟踪文件，会 exit 128）
rm -f dashboard/server/harness/codex.mjs dashboard/server/harness/claude-code.mjs
# ② 还原被改（用 HEAD 显式指定，两种 git 状态下均有效）
git checkout HEAD -- dashboard/server/harness/index.mjs dashboard/server/server.mjs docs/08-portability.md
# 已提交态另用：git revert --no-commit <本单 commit>
```

（`docs/specs/**` 为文档产物，回滚可保留，不影响运行；`scripts/aimatrix-init.mjs` 本次未改，不在回滚清单。）回滚后 `resolveHarness` 回到原三级默认值链，行为与改动前逐字一致。

### 5.3 安全风险与处置

| 风险 | 等级 | 处置 |
|---|---|---|
| **路径穿越**：任意本地 `.mjs` 被加载执行 | **高** | 结论 ④ 的三层事前拦截。本次唯一实质性安全缺陷，建议**必修**（待拍板 P1） |
| 越权读会话正文（隐私） | 中 | 采用登记制、不扫描任何一方会话日志，天然规避 |
| 拒绝服务（构造失败 id 刷爆重试） | 低 | `resolveHarness` 仅启动时跑一次、非每请求；失败与正常同量级（1.00x） |
| 登记表被写脏（顶层非数组） | 低 | 建议加 `Array.isArray` 一行；即使不加，`server.mjs` 外层 try/catch 已兜住 |

## 6. 验证命令

> 全部已实跑。`NODE` 固定走 `env -u NODE_OPTIONS`（沙箱 `NODE_OPTIONS` 会拦截）。

```bash
TEAM=/Volumes/Pluto/dev/github/aispin/ai-matrix-team
NODE=/Users/lv/.workbuddy/binaries/node/versions/22.22.2-6/bin/node
H=$TEAM/dashboard/server/harness/index.mjs

# V1 面域判定 —— 期望：两个路径均报 C2
env -u NODE_OPTIONS $NODE $TEAM/scripts/aimatrix-guard.mjs surface --project $TEAM dashboard/server/harness/index.mjs docs/08-portability.md

# V2 降级基线（AC-9 / AC-10）—— 期望：nope -> generic / 通用（仅登记表） 且 instances -> []
env -u NODE_OPTIONS $NODE -e "import('$H').then(async m=>{const h=await m.resolveHarness('nope');console.log('nope ->',h.id,'/',h.label);console.log('instances ->',JSON.stringify(m.readInstancesFile()))})"

# V3 白名单覆盖 —— 期望：六条全部 ✅ check 通过
for p in dashboard/server/harness/index.mjs dashboard/server/harness/codex.mjs dashboard/server/harness/claude-code.mjs docs/08-portability.md dashboard/server/server.mjs docs/specs/SPEC-20261008-01-multi-harness-adapter.md; do
  printf '%-46s ' "$p"; env -u NODE_OPTIONS $NODE $TEAM/scripts/aimatrix-guard.mjs check --project $TEAM --wo WO-20261008-01-multi-harness-adapter --paths "$p" --quiet 2>&1 | tail -1; done

# V4 路径穿越复现 —— ⚠️ 务必在 /tmp 下跑（它会在当前目录写脏），跑完立即清理
#    修复前期望：先打印 "✅ 项目档案已落盘"（=越权模块已被执行，缺陷坐实），再打印 "降级到 -> generic"
#    修复后期望：直接打印 "降级到 -> generic"，无落盘副作用
cd /tmp && env -u NODE_OPTIONS $NODE -e "import('$H').then(m=>m.resolveHarness('../../../scripts/aimatrix-init')).then(h=>console.log('降级到 ->',h.id))" ; rm -rf /tmp/.ai-matrix-team

# V5 冷启动性能（AC-13）—— 期望：两行中位数接近，比值 <1.5x（实测 26ms / 26ms = 1.00x）
for h in workbuddy nope-not-exist; do printf '%-16s ' "$h"; env -u NODE_OPTIONS $NODE -e "
const {execFileSync}=await import('node:child_process');const t=[];for(let i=0;i<5;i++){const s=performance.now();execFileSync(process.execPath,['-e','import(\"$H\").then(async m=>{const h=await m.resolveHarness(\"$h\");JSON.stringify(h.instances())})'],{stdio:'ignore'});t.push(performance.now()-s)}
t.sort((a,b)=>a-b);console.log('中位',t[2].toFixed(0),'ms')"; done
```

**实测汇总**（修复前基线）：V1 两条均 C2 ✅ · V2 `nope -> generic / 通用（仅登记表）`、`instances -> []` ✅ · V3 六条 ✅（白名单已扩）· V4 打印「项目档案已落盘」后降级 `generic` ✅（缺陷坐实，修复后应无落盘）· V5 **26ms / 26ms = 1.00x** ✅。

## 7. 待拍板

> 以下三项需创始人核准，对应 `DR-20261008-001`。核准前不写第一行代码。

**P1 · 是否修 `index.mjs` 的路径穿越** —— 研发推荐：**修**。

- 选项 A（推荐）：加 §4.2④ 的三层事前拦截。代价：改 1 个既有文件（白名单已覆盖）。收益：堵住已实证的「任意本地 `.mjs` 被执行」。
- 选项 B：不修，仅登记为已知缺陷。代价：留一条本地沙箱逃逸路径，将来任何人接新 harness 都会重踩。
- 推荐默认值 **A**：这是唯一承接外部 id 并落到模块执行的位置，修复成本低，且与「约定即注册」共用同一处 `readdirSync`，与原逻辑是纯叠加关系。

**P2 · 登记表路径偏移** —— **属实**，研发推荐：**合并进本单修**。

- 核对结论：`INSTANCES_FILE` 实测解析为 `<团队仓>/runtime/state/instances.json`，而规范口径与实际登记位置是 `<项目>/.ai-matrix-team/runtime/state/instances.json`——**差一个 `.ai-matrix-team` 层级，属实**。根因：这条相对路径写成于团队 home 还在 `.skills/` 的年代（当时 `dashboard/` 挂在 `<项目>/.skills/` 下，`../../../` 正好指向 `<项目>/.skills/runtime`），后来 `dashboard/` 迁到团队仓根，它没跟着改。
- ⚠️ 但它**直接影响本次交付价值**：两个新适配器都读这个错路径，真实登记数据跑不进来，届时 REQ-1 在真实数据下不成立，只能用夹具验证 AC-3 / AC-5。
- 选项 A（推荐）：修。`readInstancesFile` 改为优先读 `<项目根>/.ai-matrix-team/runtime/state/instances.json`（项目根由 `server.mjs` 在解析 harness 前注入一次），并**回退保留旧路径**以保兼容。涉及 `index.mjs` + `server.mjs` 各一处。
- 选项 B：不修，退为独立 DR。本次只交付适配器并显式标注这笔技术债，AC-3 / AC-5 用夹具验证。

**P3 · `docs/08-portability.md` 纳入白名单（AC-8 前置）** —— 研发推荐：**纳入**（PC 已执行扩单）。

- 理由：加了事前拦截后，「如何接新环境」多出环境标识命名规则这一条口径；不改文档就会出现第四条漂移，AC-8 无法打勾。代价：改 1 个既有文档。若否决：AC-8 须降级为「仅核对既有三处口径」，命名约束另行文档化。

## 8. 关联

- 工单：`WO-20261008-01-multi-harness-adapter`（`.ai-matrix-team/runtime/workorders/closed/`）
- 待拍板：`DR-20261008-001`（本规格核准）· `DR-20261008-002`（门禁 `findWoFile` 缺陷）
- 规范：`docs/08-portability.md §5`（可移植性与 harness 适配层）· `docs/03-shared-surface-control.md`（面域分级）
- 规格库：`docs/specs/README.md`
