#!/usr/bin/env node
/**
 * aimatrix-migrate-v2.mjs —— 旧单据体系 → v2 三表（SPEC-20261010-03）
 *
 * 用法：
 *   node scripts/aimatrix-migrate-v2.mjs --project <项目根> [--dry]     # 显式迁移（Agent 接到「升级」指令时跑）
 *   node scripts/aimatrix-migrate-v2.mjs --project <项目根> --auto      # 自动模式（guard/console 启动钩子调用）
 *
 * 自动模式语义：marker（runtime/state/v2-migrated）存在 → 静默跳过；
 * 无旧单据（纯新项目）→ 写 marker 后跳过；有旧单据 → 静默迁移。
 *
 * 动作：
 *  1. 补齐 .ai-matrix-team/{issues,workorders,decisions}.md 骨架（已存在则跳过）
 *  2. runtime/decisions/open/DR-*.md → decisions.md h2 条目块（状态原样保留）；
 *     原文件移入 runtime/decisions/migrated/（退出 dr scan 扫描范围，只读留档）
 *  3. runtime/workorders/INDEX.md 活跃行 → workorders.md（状态映射；
 *     DONE 直接归档 runtime/archive/YYYY-MM.md）；INDEX 头部加冻结注记
 *  4. LEDGER.md / OPEN-ITEMS.md / closed/ 一律不动（历史只读）
 *  5. 铁律：本脚本只管迁移，不碰项目业务文件；除三表/骨架/migrated/ 与 INDEX 冻结注记外不改任何内容
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const pi = argv.indexOf('--project');
const ROOT = pi >= 0 ? path.resolve(argv[pi + 1]) : process.cwd();
const DRY = argv.includes('--dry');
const AUTO = argv.includes('--auto');
const M = path.join(ROOT, '.ai-matrix-team');
const MARKER = path.join(M, 'runtime', 'state', 'v2-migrated');
const today = new Date().toISOString().slice(0, 10);
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

const SKELETONS = {
  'issues.md': '# Issues · 未处理事项白板\n\n> 用户随手记：文末追加 `## 标题` + 一句话即可；agent 一律经 `guard issues add|triage|close|normalize` 写入。\n> 状态：OPEN / TRIAGED。闭环整块移入 `runtime/archive/YYYY-MM.md`。\n\n（当前无未处理事项）\n',
  'workorders.md': '# Workorders · 任务表\n\n> agent 经 `guard wo table add|start|verify|done|block` 维护；EXECUTING 即锁定。C1/C2 或 L2 必挂详情单 `runtime/wo-details/<单号>.md`。\n\n| 单号 | 任务名 | 简述 | 关联 | 状态 | 处理者 | 锁定 | 更新 |\n|---|---|---|---|---|---|---|---|\n',
  'decisions.md': '# Decisions · 决策请求\n\n> agent 产生（`guard dr add`）；用户唯一动作 = 改「回填」行（`ZEO 10-11 选2`）。\n> 状态：OPEN / ANSWERED / DEFERRED / EXPIRED / WITHDRAWN。闭环条目移入 `runtime/archive/YYYY-MM.md`。\n\n',
};

const log = (...a) => console.log(...a);
const die = (m) => { console.error('⛔ ' + m); process.exit(1); };

if (!fs.existsSync(M)) die(`${M} 不存在——不是 ai-matrix 项目，拒绝迁移`);

// 自动模式：marker 已在 → 静默跳过
if (AUTO && fs.existsSync(MARKER)) process.exit(0);

// 自动模式：判定是否需要迁移（有旧单据才动；纯新项目写 marker 即走）
const hasLegacy =
  (fs.existsSync(path.join(M, 'runtime', 'decisions', 'open')) &&
    fs.readdirSync(path.join(M, 'runtime', 'decisions', 'open')).some((f) => /^DR-\d{8}-\d{3}.*\.md$/.test(f))) ||
  (fs.existsSync(path.join(M, 'runtime', 'workorders', 'INDEX.md')) &&
    read(path.join(M, 'runtime', 'workorders', 'INDEX.md')).includes('| WO-'));
if (AUTO && !hasLegacy) {
  if (!DRY) { fs.mkdirSync(path.dirname(MARKER), { recursive: true }); fs.writeFileSync(MARKER, today); }
  process.exit(0);
}

if (DRY) log('（dry-run：不写盘）');

// ---------- 1. 三表骨架 ----------
for (const [f, header] of Object.entries(SKELETONS)) {
  const p = path.join(M, f);
  if (!fs.existsSync(p)) { if (!DRY) fs.writeFileSync(p, header); log(`✚ 骨架 ${f}`); }
}

// ---------- 2. open DR → decisions.md ----------
const drTable = path.join(M, 'decisions.md');
const field = (text, name) => {
  const m = text.match(new RegExp(`\\|\\s*\\*{0,2}${name}\\*{0,2}\\s*\\|\\s*([^|]*?)\\s*\\|`));
  return m ? m[1].replace(/`/g, '').trim() : '';
};
const section = (text, re) => {
  const m = text.split(/^##\s+/m).find((s) => re.test(s.split('\n')[0]));
  return m || '';
};
const drBlocksOf = (text) => {
  const lines = text.split('\n');
  const pre = [];
  const blocks = [];
  let cur = null;
  for (const ln of lines) {
    if (/^## /.test(ln)) { if (cur) blocks.push(cur); cur = { head: ln, lines: [] }; }
    else if (cur) cur.lines.push(ln);
    else pre.push(ln);
  }
  if (cur) blocks.push(cur);
  return { pre: pre.join('\n'), blocks };
};

const openDir = path.join(M, 'runtime', 'decisions', 'open');
const migratedDir = path.join(M, 'runtime', 'decisions', 'migrated');
let drMigrated = 0;
if (fs.existsSync(openDir)) {
  const files = fs.readdirSync(openDir).filter((f) => /^DR-\d{8}-\d{3}.*\.md$/.test(f)).sort();
  let text = read(drTable);
  for (const f of files) {
    const full = path.join(openDir, f);
    const doc = read(full);
    const id = (path.basename(f).match(/DR-\d{8}-\d{3}/) || [path.basename(f, '.md')])[0];
    if (text.includes(`## ${id} `)) { log(`↷ ${id} 已在 decisions.md，跳过`); continue; }
    const title = (doc.match(/^#\s+DR-\d{8}-\d{3}\s*·\s*(.+)$/m) || [, field(doc, '一句话') || '（见原单）'])[1].trim();
    // 选项表：§3 内表格行首列 + ✅ 推荐位
    const sec3 = section(doc, /^3\.?\s*选项/);
    const opts = [];
    let rec = '';
    for (const line of sec3.split('\n')) {
      if (!/^\|/.test(line) || /^\|[-\s|]+\|$/.test(line) || /^\|\s*方案/.test(line)) continue;
      const c = line.split('|').map((x) => x.trim());
      const name = (c[1] || '').replace(/\*\*/g, '');
      if (!name) continue;
      opts.push(name);
      if (c.some((x) => x.includes('✅'))) rec = String(opts.length);
    }
    const owner = field(doc, '所属') || '—';
    const blocking = /BLOCKING/i.test(field(doc, '阻塞级别') || '') && !/NON/i.test(field(doc, '阻塞级别') || '');
    const status = (field(doc, '状态') || 'OPEN').toUpperCase();
    const optLines = opts.length ? ['方案：', ...opts.map((o, i) => `${i + 1}. ${o}`)] : ['方案: 见原单（migrated/ 只读留档）'];
    const block = [`## ${id} ${title}`, ...optLines, `推荐: ${rec || '—'} · 关联: ${owner} · 状态: ${status} · 阻塞: ${blocking ? 'BLOCKING' : 'NON-BLOCKING'} · 更新: ${today}`, '回填: （待答复，直接改本行）', `原单: runtime/decisions/migrated/${f}`].join('\n');
    text = text.replace(/\n*$/, '\n\n') + block + '\n';
    if (!DRY) {
      fs.mkdirSync(migratedDir, { recursive: true });
      fs.renameSync(full, path.join(migratedDir, f));
      fs.writeFileSync(drTable, text);
    }
    drMigrated++;
    log(`➜ DR ${id} → decisions.md（${status}${blocking ? ' · BLOCKING' : ''}，${opts.length} 个方案）`);
  }
}

// ---------- 3. INDEX 活跃行 → workorders.md ----------
const indexFile = path.join(M, 'runtime', 'workorders', 'INDEX.md');
let woMigrated = 0; let woArchived = 0;
if (fs.existsSync(indexFile)) {
  const idxText = read(indexFile);
  if (!idxText.includes('已迁移 v2')) {
    const activeSection = idxText.split(/^## 归档单/m)[0] || '';
    const statusOf = (raw) => {
      const t = (raw || '').replace(/\*\*/g, '').trim();
      const head = t.split(/[（(]/)[0].trim();
      if (/^DONE/i.test(head)) return 'DONE';
      if (/^IMPLEMENTING/i.test(head)) return 'EXECUTING';
      if (/^VERIFYING/i.test(head)) return 'VERIFYING';
      if (/BLOCKED_DR/i.test(head)) return 'BLOCKED_DR';
      return 'TODO'; // DRAFT / APPROVED / 其他
    };
    const rows = [];
    const doneRows = [];
    for (const line of activeSection.split('\n')) {
      if (!/^\| WO-/.test(line)) continue;
      const c = line.split('|').map((x) => x.trim()).filter((x) => x !== '');
      if (c[0] === '（暂无活跃单）') continue;
      const id = c[0].split(/\s+/)[0];
      const purpose = (c[2] || '').replace(/\*\*/g, '').slice(0, 30) || '—';
      const drRef = (c[6] && c[6] !== '—') ? c[6].replace(/\*\*/g, '').slice(0, 40) : '—';
      const st = statusOf(c[7]);
      const row = { c: [id, id.replace(/^WO-\d{8}-\d{2}-?/, '') || '旧单迁移', purpose, drRef, st, (c[3] || '—').replace(/\*\*/g, '').slice(0, 24), st === 'EXECUTING' ? '🔒' : '—', today] };
      if (st === 'DONE') doneRows.push(row); else rows.push(row);
    }
    if (rows.length || doneRows.length) {
      const woTable = path.join(M, 'workorders.md');
      let wt = read(woTable);
      for (const r of rows) {
        if (wt.includes(`| ${r.c[0]} |`)) { log(`↷ ${r.c[0]} 已在 workorders.md，跳过`); continue; }
        wt = wt.replace(/\n*$/, '\n') + `| ${r.c.join(' | ')} |\n`;
        woMigrated++;
        log(`➜ WO ${r.c[0]} → workorders.md（${r.c[4]}）`);
      }
      if (!DRY) fs.writeFileSync(woTable, wt);
      if (doneRows.length) {
        fs.mkdirSync(path.join(M, 'runtime', 'archive'), { recursive: true });
        const arch = path.join(M, 'runtime', 'archive', `${today.slice(0, 7)}.md`);
        let at = read(arch);
        if (!at) at = '# 归档 · 已闭环单据（append-only）\n\n';
        for (const r of doneRows) {
          at = at.replace(/\n*$/, '\n\n') + `## WO ${r.c[0]} ${r.c[1]}（归档 ${today}）\n简述: ${r.c[2]} · 关联: ${r.c[3]} · 终态: DONE · 处理者: ${r.c[5]} · 更新: ${today}\n`;
          woArchived++;
          log(`➜ WO ${r.c[0]} → archive（DONE）`);
        }
        if (!DRY) fs.writeFileSync(arch, at);
      }
    }
    if (!DRY) {
      const banner = idxText.replace(/^# 任务单索引（活跃）/, '# 任务单索引（已冻结 · 已迁移 v2）\n\n> ⚠ 本表已于 ' + today + ' 迁移至 `.ai-matrix-team/workorders.md`（SPEC-20261010-03），**只读留存**，勿再更新；活跃单以 workorders.md 为准。');
      fs.writeFileSync(indexFile, banner);
    }
    log('✎ INDEX.md 已冻结（只读留存）');
  }
}

log(`\n小结：DR 迁移 ${drMigrated} · WO 迁移 ${woMigrated} · WO 归档 ${woArchived}${DRY ? '（dry-run 未写盘）' : ''}`);

// 收尾写 marker：自动模式不重复迁移
if (!DRY) { fs.mkdirSync(path.dirname(MARKER), { recursive: true }); fs.writeFileSync(MARKER, today); }
