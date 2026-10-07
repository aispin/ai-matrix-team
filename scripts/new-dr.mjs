#!/usr/bin/env node
/**
 * new-dr — 生成 DR（决策请求）骨架，自动取当日序号。
 * 用法示例：
 *   node <team-repo>/scripts/new-dr.mjs --title "是否永久免费" --type 1 --blocking \
 *     --wo WO-20261005-01-guard-bootstrap --trigger D1 --by "毛毛·product-manager" \
 *     --default "不承诺永久免费，首年免费"
 * 退出码：0 成功 · 1 参数错误
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ---------- 项目根解析（--project / AIM_PROJECT_ROOT / 含 .ai-matrix-team 的 cwd） ----------
let _PROJECT;
function PROJECT() {
  if (_PROJECT) return _PROJECT;
  const i = process.argv.indexOf('--project');
  const cand = i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1])
    : process.env.AIM_PROJECT_ROOT ? path.resolve(process.env.AIM_PROJECT_ROOT)
    : fs.existsSync(path.join(process.cwd(), '.ai-matrix-team')) ? process.cwd()
    : process.cwd();
  _PROJECT = cand;
  return cand;
}
const REPO_ROOT = PROJECT();
const DR_OPEN = path.join(REPO_ROOT, '.ai-matrix-team', 'runtime', 'decisions', 'open');
const DR_CLOSED = path.join(REPO_ROOT, '.ai-matrix-team', 'runtime', 'decisions', 'closed');

const argv = process.argv.slice(2);
const get = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (k) => argv.includes(k);

const title = get('--title');
if (!title) { console.error('缺少 --title'); process.exit(1); }
const type = get('--type') === '1' ? 'Type 1（不可逆）' : 'Type 2（可逆）';
const blocking = has('--blocking') ? 'BLOCKING' : 'NON-BLOCKING';
const trigger = get('--trigger') || 'D5';
const by = get('--by') || 'Agent';
const wo = get('--wo') || '';
const app = get('--app') || '';
const contract = get('--contract') || '';
const def = get('--default') || '（填写：人回一句「按默认」就能推进的值）';
const dry = has('--dry-run');

if (!wo && !app && !contract) { console.error('--wo / --app / --contract 三选一必填（所属）'); process.exit(1); }

// 当日序号：扫 open + closed
const today = new Date();
const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
let maxSeq = 0;
for (const dir of [DR_OPEN, DR_CLOSED]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(new RegExp(`^DR-${ymd}-(\\d{3})`));
    if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
  }
}
const seq = String(maxSeq + 1).padStart(3, '0');
const id = `DR-${ymd}-${seq}`;
const slug = title.replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'untitled';
const file = path.join(DR_OPEN, `${id}-${slug}.md`);

const owner = wo ? `WO-${wo.replace(/^WO-/, '')}` : (app ? `App: \`${app}\`` : `契约: \`${contract}\``);
// 所属字段不需要 WO- 前缀重复
const ownerLine = wo ? wo : (app ? `App: \`${app}\`` : `契约: \`${contract}\``);
void owner;

const deadline = new Date(today.getTime() + (blocking === 'BLOCKING' ? 7 : 2) * 86_400_000);
const dl = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}`;

const content = `# ${id} · ${title}

> 由 new-dr.mjs 生成骨架；提出者补全 §2–§5 后跑 \`wo lint\` 校验。

| 字段 | 值 |
|---|---|
| **id** | \`${id}\` |
| 提出者 | ${by} |
| 所属 | ${ownerLine} |
| **决策类型** | ${type} |
| **阻塞级别** | ${blocking} |
| 触发类型 | ${trigger} |
| 提出日期 | ${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)} |
| 期限 | ${dl}${blocking === 'BLOCKING' ? '（BLOCKING 不因超时自动通过）' : '（NON-BLOCKING +48h 按默认执行）'} |
| **状态** | OPEN |

---

## 1. 问题（一句话，必须可回答）

${title}？

## 2. 为什么需要你

我做不了：______ ／ 不该替你决定：______（二选一或都写，不许空着）

## 3. 选项

| 方案 | 代价 | 收益 | 推荐 |
|---|---|---|---|
| A | | | |
| B | | | ✅ |

## 4. 建议默认值

> 你回一句「按默认」我就直接推进：${def}

## 5. 不做的后果 / 超时行为

- ${blocking === 'BLOCKING' ? 'BLOCKING：任务停在 ______ 阶段，等你答复（不许沉默通过）。' : `NON-BLOCKING：48h 无答复 → 按 §4 默认执行（${def}），台账标注后可推翻（推翻代价：______）。`}

## 6. 影响面

受影响 App / 服务 / 已上线产物 / 对外承诺：

## 7. 关联文档

\`${wo ? wo + ' · ' : ''}${app ? 'apps/' + app + '/docs/ · ' : ''}BRD §x / PRD §y / TDD §z\`

---

## 8. 答复（创始人填写 / 由 Agent 回填原文）

- 答复人：创始人 · 日期：
- 结论：选 ______ ／ 按默认 ／ 其他：______
- 原文：

## 9. 回填记录（提出者关闭 DR 前必填）

- [ ] 结论已写回：BRD §x / PRD §y / TDD §z / ADR-xxxx / shared-contracts.md / 代码注释
- [ ] LEDGER.md 已更新（\`<team-repo>/scripts/ledger-sync.mjs\`）
- [ ] 若影响 App 的 OPEN-ITEMS：\`<team-repo>/scripts/render-open-items.mjs\` 已同步
- [ ] 文件移入 \`decisions/closed/\`
`;

if (dry) { console.log(`[dry-run] ${id} -> ${file}`); console.log(content); process.exit(0); }
fs.mkdirSync(DR_OPEN, { recursive: true });
fs.writeFileSync(file, content);
console.log(`✅ ${id} 已落盘：${path.relative(REPO_ROOT, file)}`);
console.log(`下一步：① 补全 §2–§5 → ② guard wo lint 校验 → ③ ledger-sync.mjs 同步台账 → ④ BLOCKING 当轮通报创始人。`);
