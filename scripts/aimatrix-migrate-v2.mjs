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
 *  0. 目录改名迁移：`.ai-matrix-team/` → `.aimt/`（原子 rename，幂等；surfaces.json 旧目录名模式重写）
 *  1. 补齐 .aimt/{issues,workorders,decisions}.md 骨架（已存在则跳过）
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
const M = path.join(ROOT, '.aimt');
const MARKER = path.join(M, 'runtime', 'state', 'v2-migrated');
const today = new Date().toISOString().slice(0, 10);
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

const USAGE = [
  '用法：node aimatrix-migrate-v2.mjs --project <项目根> [--dry | --auto]',
  '  --dry   显式预演（不写盘）',
  '  --auto  自动模式（guard/console 启动钩子调用，幂等）',
  '两者必选其一——不带模式参数一律拒绝执行，防误触真迁移。',
].join('\n');
if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); process.exit(0); }
if (!DRY && !AUTO) { console.error('⛔ 缺模式参数（--dry / --auto 必选其一），已拒绝执行、未写盘。\n' + USAGE); process.exit(2); }

const SKELETONS = {
  'issues.md': '# Issues · 未处理事项白板\n\n> 用户随手记：文末追加 `## 标题` + 一句话即可；agent 一律经 `guard issues add|triage|close|normalize` 写入。\n> 状态：OPEN / TRIAGED。闭环整块移入 `runtime/archive/YYYY-MM.md`。\n\n（当前无未处理事项）\n',
  'workorders.md': '# Workorders · 任务表\n\n> agent 经 `guard wo table add|start|verify|done|block` 维护；EXECUTING 即锁定。C1/C2 或 L2 必挂详情单 `runtime/wo-details/<单号>.md`。\n\n| 单号 | 任务名 | 简述 | 关联 | 状态 | 处理者 | 锁定 | 更新 |\n|---|---|---|---|---|---|---|---|\n',
  'decisions.md': '# Decisions · 决策请求\n\n> agent 产生（`guard dr add`）；用户唯一动作 = 改「回填」行（`ZEO 10-11 选2`）。\n> 状态：OPEN / ANSWERED / DEFERRED / EXPIRED / WITHDRAWN。闭环条目移入 `runtime/archive/YYYY-MM.md`。\n\n',
};

const log = (...a) => console.log(...a);
const die = (m) => { console.error('⛔ ' + m); process.exit(1); };

// ---------- -1. 目录改名迁移（.ai-matrix-team → .aimt）：同盘原子 rename，幂等 ----------
const LEGACY = path.join(ROOT, '.ai-matrix-team');
if (fs.existsSync(LEGACY)) {
  if (fs.existsSync(M)) {
    log(`⚠ 新旧目录并存（.aimt 与 .ai-matrix-team）——保留 .aimt，旧目录未动，请人工核对后删除`);
  } else if (DRY) {
    log('✎ 目录改名 .ai-matrix-team → .aimt（dry-run 未执行）');
  } else {
    fs.renameSync(LEGACY, M);
    log('✎ 目录已改名：.ai-matrix-team → .aimt');
  }
}
if (!fs.existsSync(M) && !(DRY && fs.existsSync(LEGACY))) die(`${M} 不存在——不是 ai-matrix 项目，拒绝迁移`);

// ---------- 0. surfaces.json 漂移自愈（幂等，AUTO/marker 前置执行）：补齐默认 wo 块 + 旧措辞归一 ----------
// 存量项目副本落后于 surfaces-default.json（如 statusesActive 缺 TODO/EXECUTING）时，EXECUTING 单 check 恒失败。
const surfFile = path.join(M, 'surfaces.json');
const defSurf = new URL('surfaces-default.json', import.meta.url);
if (fs.existsSync(surfFile) && fs.existsSync(defSurf)) {
  try {
    const def = JSON.parse(fs.readFileSync(defSurf, 'utf8'));
    const proj = JSON.parse(fs.readFileSync(surfFile, 'utf8'));
    let changed = false;
    if (def.wo) {
      const merged = { ...def.wo, ...(proj.wo || {}) };
      for (const k of ['statusesActive', 'statusesNeedingLock']) {
        const v = [...new Set([...(def.wo[k] || []), ...((proj.wo || {})[k] || [])])];
        if (JSON.stringify(v) !== JSON.stringify((proj.wo || {})[k])) { merged[k] = v; changed = true; }
      }
      if (!proj.wo) changed = true;
      proj.wo = merged;
    }
    let out = JSON.stringify(proj, null, 2) + '\n';
    const unworded = out.replace(/资深风控师/g, '团长（风控）');
    if (unworded !== out) { out = unworded; changed = true; }
    const renamed = out.replace(/\.ai-matrix-team/g, '.aimt');
    if (renamed !== out) { out = renamed; changed = true; }
    if (changed && !DRY) fs.writeFileSync(surfFile, out);
    if (changed) log(`✎ surfaces.json 漂移自愈（wo 块补齐/措辞归一）${DRY ? '（dry-run 未写盘）' : ''}`);
  } catch (e) { log(`⚠ surfaces.json 自愈失败：${e.message}`); }
}

// ---------- 0.5 消费端旧引用扫描/改写（githooks + CI workflows + project.json）----------
// 改名 .aimt 后消费端 .githooks/pre-commit 与 CI 可能仍读旧路径 → 门禁静默失效（比报错更危险），在此一并改写；
// 旧脚本名与旧台账布局无法安全自动改写，只告警指路。
const consumerFiles = () => {
  const found = [];
  for (const dir of ['.githooks', '.github/workflows']) {
    const d = path.join(ROOT, dir);
    if (!fs.existsSync(d)) continue;
    const walk = (p) => fs.readdirSync(p, { withFileTypes: true }).forEach((e) => {
      const fp = path.join(p, e.name);
      if (e.isDirectory()) walk(fp);
      else if (/\.(sh|yml|yaml|json|md|txt)$|pre-commit|pre-push/.test(e.name)) found.push(fp);
    });
    walk(d);
  }
  const pj = path.join(fs.existsSync(M) ? M : LEGACY, 'project.json');
  if (fs.existsSync(pj)) found.push(pj);
  return found;
};
{
  let hits = 0; const warns = [];
  for (const f of consumerFiles()) {
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const out2 = txt.replace(/\.ai-matrix-team/g, '.aimt');
    if (/install-to-workbuddy\.mjs/.test(txt)) warns.push(`${path.relative(ROOT, f)}: 引用已弃用脚本 install-to-workbuddy.mjs（早已改名 aimatrix-install.mjs），请改调用行`);
    if (/runtime\/(workorders\/WO-|decisions\/open\/DR-)/.test(txt)) warns.push(`${path.relative(ROOT, f)}: 引用旧台账布局 runtime/workorders|decisions/open（v2 起为 runtime/wo-details/ 与 decisions.md 条目块），lint 可能空转`);
    if (out2 !== txt) { hits++; if (!DRY) fs.writeFileSync(f, out2); }
  }
  if (hits) log(`✎ 消费端旧目录引用 .ai-matrix-team → .aimt：${hits} 个文件${DRY ? '（dry-run 未写盘）' : '（已改写）'}`);
  for (const w of warns) log(`⚠ ${w}`);
}

// 自动模式：marker 已在且旧布局详情单已清空 → 静默跳过（否则补跑第 4 步的搬迁/规范化）
const legacyDetailsLeft = () => ['open', 'closed'].some((d) => {
  const dir = path.join(M, 'runtime', 'workorders', d);
  return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => /^WO-\d{8}-\d{2}.*\.md$/.test(f));
});
if (AUTO && fs.existsSync(MARKER) && !legacyDetailsLeft()) process.exit(0);

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
      const banner = idxText.replace(/^# 任务单索引（活跃）/, '# 任务单索引（已冻结 · 已迁移 v2）\n\n> ⚠ 本表已于 ' + today + ' 迁移至 `.aimt/workorders.md`（SPEC-20261010-03），**只读留存**，勿再更新；活跃单以 workorders.md 为准。');
      fs.writeFileSync(indexFile, banner);
    }
    log('✎ INDEX.md 已冻结（只读留存）');
  }
}

// ---------- 4. 单号规范化 + 详情单搬迁（v2 消费端切表：workorders.md 为唯一真相源） ----------
// 旧布局：详情单在 runtime/workorders/{open,closed}/，单号形如 WO-YYYYMMDD-NN-<slug>。
// v2：单号只认 WO-YYYYMMDD-NN（guard wo table 的格式门禁），详情单落 runtime/wo-details/<单号>.md。
const WO_TABLE = path.join(M, 'workorders.md');
const DETAILS = path.join(M, 'runtime', 'wo-details');
const shortId = (s) => (String(s).match(/^WO-\d{8}-\d{2}/) || [String(s)])[0];
const detailStatus = (file) => ((read(file).match(/\|\s*\*{0,2}状态\*{0,2}\s*\|\s*`?([A-Z_]+)`?/) || [])[1] || '—');
// 旧状态词表 → v2 状态机（TODO → EXECUTING → VERIFYING → DONE / BLOCKED_DR）；
// 不归一到 v2，`wo table` 的状态门禁会拒收（done 只认 EXECUTING/VERIFYING/BLOCKED_DR）。
const V2_STATUS = { IMPLEMENTING: 'EXECUTING', LOCKED: 'EXECUTING', APPROVED: 'TODO', DRAFT: 'TODO' };
let idFixed = 0, stFixed = 0, moved = 0, adopted = 0, doneLeft = 0;

// 表在内存里改完、最后一次性写盘：dry-run 与真实运行看到同一份中间态（否则 dry 会误判「表里没有」）
const tableLines = (fs.existsSync(WO_TABLE) ? read(WO_TABLE) : SKELETONS['workorders.md']).split('\n');
const hasRow = (id) => tableLines.some((l) => l.startsWith(`| ${id} |`));
{
  const head = tableLines.findIndex((l) => l.startsWith('| 单号'));
  if (head >= 0) {
    for (let i = head + 2; i < tableLines.length; i++) {
      if (!tableLines[i].startsWith('|')) break;
      const c = tableLines[i].split('|').slice(1, -1).map((x) => x.trim());
      if (/^WO-\d{8}-\d{2}-/.test(c[0])) {
        const short = shortId(c[0]);
        const slug = c[0].slice(short.length).replace(/^-/, '');
        c[0] = short;
        if (slug && (!c[1] || c[1] === '—' || c[1] === '旧单迁移')) c[1] = slug;
        idFixed++;
      }
      if (V2_STATUS[c[4]]) { c[4] = V2_STATUS[c[4]]; stFixed++; }
      tableLines[i] = `| ${c.join(' | ')} |`;
    }
    if (idFixed) log(`➜ 表行单号规范化 ${idFixed} 行 → WO-YYYYMMDD-NN`);
    if (stFixed) log(`➜ 表行状态归一 ${stFixed} 行 → v2 状态机`);
  }
}

for (const d of ['open', 'closed']) {
  const dir = path.join(M, 'runtime', 'workorders', d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/^WO-\d{8}-\d{2}.*\.md$/.test(f)) continue;
    const id = shortId(f);
    if (f.endsWith('.journal.md')) {
      const to = path.join(DETAILS, `${id}.journal.md`);
      if (fs.existsSync(to)) { log(`↷ ${f} 已有 ${id}.journal.md，跳过`); continue; }
      if (!DRY) { fs.mkdirSync(DETAILS, { recursive: true }); fs.renameSync(path.join(dir, f), to); }
      log(`➜ 执行日志 ${f} → runtime/wo-details/${id}.journal.md`);
      continue;
    }
    const to = path.join(DETAILS, `${id}.md`);
    if (fs.existsSync(to)) { log(`↷ ${f} 已有 ${id}.md，跳过`); continue; }
    const status = detailStatus(path.join(dir, f));
    if (!DRY) { fs.mkdirSync(DETAILS, { recursive: true }); fs.renameSync(path.join(dir, f), to); }
    moved++;
    // open/ 里没进表的单：非 DONE 补一行（③ 收口的输入，否则 report 看不见）；
    // DONE 只搬详情单不补行——完单不该被塞回活动表。
    if (d !== 'open' || hasRow(id)) continue;
    if (status === 'DONE') { doneLeft++; log(`➜ 已完工单 ${id}（不补行，只搬详情单）`); continue; }
    const slug = f.slice(id.length).replace(/^-/, '').replace(/\.md$/, '');
    // 表尾可能带空行；补行必须紧贴表格（parser 遇首个非 | 行即停，隔空行 = 补行不可见）
    while (tableLines.length && tableLines[tableLines.length - 1].trim() === '') tableLines.pop();
    tableLines.push(`| ${id} | ${slug || '旧单迁移'} | 旧详情单迁移 | — | ${V2_STATUS[status] || status} | — | — | ${today} |`);
    adopted++;
    log(`➜ 补行 ${id}（${status}）`);
  }
}

if (!DRY && (idFixed || stFixed || adopted)) fs.writeFileSync(WO_TABLE, tableLines.join('\n'));

log(`\n小结：DR 迁移 ${drMigrated} · WO 迁移 ${woMigrated} · WO 归档 ${woArchived} · 单号规范化 ${idFixed} · 状态归一 ${stFixed} · 详情单搬迁 ${moved}（补行 ${adopted} · 已完工单留档 ${doneLeft}）${DRY ? '（dry-run 未写盘）' : ''}`);

// 收尾写 marker：自动模式不重复迁移
if (!DRY) { fs.mkdirSync(path.dirname(MARKER), { recursive: true }); fs.writeFileSync(MARKER, today); }
