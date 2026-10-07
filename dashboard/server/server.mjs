#!/usr/bin/env node
/**
 * AI-Matrix 专家团指挥台 · 服务端（零依赖）
 *
 *   node server.mjs [--port 4780] [--root <repo>] [--no-open]
 *
 * API（全部大白话，术语由 config.json.terms 提供）：
 *   GET /api/profile    项目与团队档案
 *   GET /api/pipeline   成员管线：谁在干什么 + 当前工单 + 待拍板
 *   GET /api/artifacts  产物清单：BRD/PRD/TDD/设计稿/ADR 按 App 分组
 *   GET /api/reports    汇报历史清单
 *   GET /api/reports/:id 单份汇报全文
 *   GET /api/tokens    词元消费估算：单据/回执/日志按字节估 token（CJK≈1/字，余 4 字节/token），
 *                      按天/周/月分桶 + 类别汇总 + 会话列表（instances.json，按关联 WO 归集）
 * 静态：托管 ../dist（PWA 构建产物），SPA 回退到 index.html。
 * 数据源：.ai-matrix-team/runtime/ 台账文件（唯一真相源）+ data/dashboard.db（汇报库）。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { resolveHarness } from './harness/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const getArg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const TEAM_ROOT = path.resolve(__dirname, '..', '..'); // 团队仓根
const ROOT = path.resolve(getArg('--project') || getArg('--root') || process.env.AIM_PROJECT_ROOT || process.cwd()); // 项目根
const PORT = Number(getArg('--port', 4780));
const DIST = path.join(__dirname, '..', 'dist');
const ABOUT = JSON.parse(fs.readFileSync(path.join(__dirname, 'about.json'), 'utf8'));
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, '.ai-matrix-team', 'project.json'), 'utf8'));
const DB = path.join(TEAM_ROOT, 'dashboard', 'data', 'dashboard.db');

// harness 适配层（DR-20261005-003）：实例/会话数据经适配器取得，WorkBuddy 细节不进主逻辑
const HARNESS = await resolveHarness(CONFIG.harness?.id || process.env.AIMATRIX_HARNESS);
const harnessInstances = () => { try { return HARNESS.instances() || []; } catch { return []; } };
/** 执行字段语法：`角色#呼号`；无 # 视为纯角色（老单兼容，DR-20261005-003） */
const parseExecutor = (e) => {
  const m = /^(.+?)#([0-9A-Za-z]+)$/.exec((e || '').trim());
  return m ? { role: m[1].trim(), callsign: m[2] } : { role: (e || '').trim(), callsign: null };
};

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const existsP = (p) => fs.existsSync(path.join(ROOT, p));


/* ---------------- 产物清单（BRD/PRD/TDD/设计稿/ADR 等，2026-10-07） ---------------- */
const DOC_TYPES = [
  { re: /_BRD_.*\.md$/i, type: 'BRD', label: '立项报告' },
  { re: /_PRD_.*\.md$/i, type: 'PRD', label: '产品需求' },
  { re: /_TDD_.*\.md$/i, type: 'TDD', label: '技术方案' },
  { re: /Overview.*\.html?$/i, type: 'OVERVIEW', label: '产品概览' },
    { re: /_SIGN-OFF_/i, type: 'SIGNOFF', label: '准出签署' },
  { re: /design[-_]?draft\.html?$/i, type: 'DESIGN', label: '设计稿' },
];
const stat = (abs) => { const st = fs.statSync(abs); return { size: st.size, mtime: st.mtime.toISOString() }; };
/* WO-20261007-19：矩阵级产品模块文档命名（BRD.md 等精确名 + design-draft.html） */
const EXACT_TYPES = {
  'BRD.md': { type: 'BRD', label: '立项报告' },
  'PRD.md': { type: 'PRD', label: '产品需求' },
  'TDD.md': { type: 'TDD', label: '技术方案' },
};
const PRODUCT_TITLES = { 'growth-plan': '成长计划' };
function scanDir(abs, rel, out, depth = 0) {
  if (depth > 3) return;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const a = path.join(abs, e.name), r = rel + '/' + e.name;
    if (e.isDirectory()) scanDir(a, r, out, depth + 1);
    else out.push({ file: e.name, path: r, ...stat(a) });
  }
}
function classifyAppDocs(abs, relBase) {
  const items = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const a = path.join(abs, e.name);
    if (e.isDirectory()) {
      if (e.name === 'design') { const sub = []; scanDir(a, relBase + '/design', sub); items.push(...sub.map((x) => ({ ...x, type: 'DESIGN', label: '设计稿' }))); }
      continue;
    }
    const hit = EXACT_TYPES[e.name] || DOC_TYPES.find((t) => t.re.test(e.name));
    if (hit) items.push({ type: hit.type, label: hit.label, file: e.name, path: relBase + '/' + e.name, ...stat(a) });
    else if (/\.(md|html?)$/i.test(e.name)) items.push({ type: 'DOC', label: '文档', file: e.name, path: relBase + '/' + e.name, ...stat(a) });
  }
  return items.sort((x, y) => x.type.localeCompare(y.type) || x.file.localeCompare(y.file));
}
function artifacts() {
  const apps = [];
  const appsDir = path.join(ROOT, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const e of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const docs = path.join(appsDir, e.name, 'docs');
      if (!fs.existsSync(docs)) continue;
      apps.push({ app: e.name, items: classifyAppDocs(docs, 'apps/' + e.name + '/docs') });
    }
  }
  // WO-20261007-19：矩阵级产品模块（docs/product/ 子目录，非 apps/ 成员）
  const productDir = path.join(ROOT, 'docs/product');
  if (fs.existsSync(productDir)) {
    for (const e of fs.readdirSync(productDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const items = classifyAppDocs(path.join(productDir, e.name), 'docs/product/' + e.name);
      if (items.length === 0) continue;
      apps.push({ app: e.name, title: PRODUCT_TITLES[e.name] || e.name, items });
    }
  }
  const shared = [];
  const pushAll = (rel, type, label) => {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith('.md')) continue;
      shared.push({ type, label, file: f, path: rel + '/' + f, ...stat(path.join(abs, f)) });
    }
  };
  pushAll('docs/decisions', 'ADR', '架构决策');
  if (fs.existsSync(productDir)) {
    for (const f of fs.readdirSync(productDir)) {
      if (!f.endsWith('.md')) continue;
      shared.push({ type: 'SPEC', label: '产品规范', file: f, path: 'docs/product/' + f, ...stat(path.join(productDir, f)) });
    }
  }
  for (const f of (fs.existsSync(path.join(ROOT, 'docs')) ? fs.readdirSync(path.join(ROOT, 'docs')) : [])) {
    if (!f.endsWith('.md') || f === 'shared-contracts.md') continue;
    shared.push({ type: 'SPEC', label: '矩阵规范', file: f, path: 'docs/' + f, ...stat(path.join(ROOT, 'docs', f)) });
  }
  shared.sort((x, y) => x.type.localeCompare(y.type) || x.file.localeCompare(y.file));
  return { apps, shared, generatedAt: new Date().toISOString() };
}

/* ---------------- 台账解析（与 aimatrix-report.mjs 同口径） ---------------- */
function activeWorkorders() {
  if (!existsP('.ai-matrix-team/runtime/workorders/INDEX.md')) return [];
  // 活跃表 = INDEX 中「## 归档单」之前的全部表格行（INDEX 无「## 活跃单」标题，勿按标题找）
  const section = read('.ai-matrix-team/runtime/workorders/INDEX.md').split(/^## 归档单/m)[0] || '';
  const rows = [];
  for (const line of section.split('\n')) {
    if (!/^\| WO-/.test(line)) continue;
    const c = line.split('|').map((x) => x.trim()).filter((x) => x !== '');
    if (c[0] === '（暂无活跃单）') continue;
    rows.push({ id: c[0], purpose: c[2] || '', executor: c[3] || '', guard: c[4] || '', status: c[7] || '' });
  }
  return rows;
}

function recentClosedWorkorders(n = 5) {
  const dir = path.join(ROOT, '.ai-matrix-team', 'runtime', 'workorders', 'closed');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.startsWith('WO-') && f.endsWith('.md')).sort().reverse().slice(0, n)
    .map((f) => {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const one = text.split(/^## 1\. 目的与背景/m)[1]?.split('\n').map((s) => s.trim()).find(Boolean) || '';
      return { id: f.replace(/\.md$/, ''), purpose: one.replace(/^# /, '').slice(0, 80) };
    });
}

function decisions() {
  if (!existsP('.ai-matrix-team/runtime/decisions/LEDGER.md')) return { open: [], closedRecent: [] };
  const open = [];
  const closedRecent = [];
  for (const line of read('.ai-matrix-team/runtime/decisions/LEDGER.md').split('\n')) {
    if (!/^\| DR-/.test(line)) continue;
    const c = line.split('|').map((x) => x.trim()).filter((x) => x !== '');
    const item = { id: c[0], oneLine: c[3] || '', blocking: /BLOCKING/i.test(c[5] || ''), status: c[6] || '', due: c[8] || '' };
    if (/OPEN/i.test(item.status)) open.push(item);
    else closedRecent.push(item);
  }
  return { open, closedRecent: closedRecent.slice(0, 5) };
}

/**
 * 锁状态归一（面域分片：lock.json schema 2 可含多个 holder）。
 *   优先读 holders[]（逐项 {wo, since: acquiredAt}）；缺失时回退 legacy 顶层 holder；
 *   无锁 → null。分片后 N≥2 是常态：消费方据此**列出全部在持单**，不得只显主 holder、不得低报。
 */
function lockState() {
  const f = path.join(ROOT, '.ai-matrix-team/runtime/state/lock.json');
  if (!fs.existsSync(f)) return null;
  let raw;
  try { raw = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const arr = Array.isArray(raw.holders) && raw.holders.length
    ? raw.holders.map((h) => ({ wo: h.wo || h.holder, since: h.acquiredAt }))
    : (raw.holder ? [{ wo: raw.holder, since: raw.acquiredAt }] : []);
  const holders = arr.filter((h) => h.wo);
  return holders.length ? { holders, count: holders.length } : null;
}

function latestInspection() {
  const dir = path.join(ROOT, '.ai-matrix-team/runtime/reviews');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.includes('巡检') && f.endsWith('.md')).sort();
  if (!files.length) return null;
  const text = fs.readFileSync(path.join(dir, files.at(-1)), 'utf8');
  const summaryLine = text.split('\n').find((l) => l.includes('小结') && /PASS|WARN|FAIL/i.test(l)) || '';
  return { file: files.at(-1), summary: summaryLine.replace(/^#+\s*/, '').trim().slice(0, 140) };
}

/* ---------------- API 组装 ---------------- */
function pipeline() {
  const inst = harnessInstances();
  const sessionOf = (callsign) => inst.find((i) => i.callsign === callsign)?.session || null;
  const wos = activeWorkorders().map((w) => {
    const { callsign } = parseExecutor(w.executor);
    return { ...w, callsign, session: callsign ? sessionOf(callsign) : null };
  });
  const lock = lockState();
  const members = ABOUT.members.map((m) => {
    let busyList = [];
    if (m.id === 'ai-matrix-team-team-lead') {
      const d = decisions();
      busyList = wos.length || d.open.length
        ? [`统筹中：${wos.length ? `${wos.length} 张工单在办` : '无在办工单'}${d.open.length ? ` · ${d.open.length} 件事等老板拍板` : ''}`]
        : [];
    } else {
      const mine = wos.filter((w) => {
        const role = parseExecutor(w.executor).role;
        return (w.executor || '').includes(m.name) || role.includes(m.name) || role.includes(m.role) || (w.executor || '').includes(m.role);
      });
      busyList = mine.map((w) => {
        const { callsign } = parseExecutor(w.executor);
        const sess = callsign ? sessionOf(callsign) : null;
        return `在办：${w.id} — ${w.purpose}${callsign ? `（${w.executor}${sess ? ` · 会话《${sess}》` : ''}）` : ''}`;
      });
    }
    return { ...m, busyList, busy: busyList[0] || '空闲，待派活', working: busyList.length > 0 };
  });
  const terms = CONFIG.terms || {};
  return {
    project: CONFIG.project,
    terms: { wo: terms.wo?.label || '工单', dr: terms.dr?.label || '待拍板', lock: terms.lock?.label || '占用' },
    harness: { id: HARNESS.id, label: HARNESS.label },
    instances: inst,
    lock,
    members,
    activeWorkorders: wos,
    closedWorkorders: recentClosedWorkorders(),
    decisions: decisions(),
    inspection: latestInspection(),
  };
}

/* ---------------- 词元（token）消费估算（WO-20261007-17，charter §4A.8 度量配套） ----------------
 * 口径声明：真实计量在宿主（WorkBuddy）侧，本端点不可得 → 按**字节估算**：
 *   CJK 字符 ≈ 1 token/字，其余按 4 字节/token。曲线/饼图反映「单据与日志的体量走势」，
 *   供优化决策参考，不冒充精确计量。日期取文件 mtime（日志取文件名日期）。
 */
const TOKEN_KINDS = [
  { kind: 'wo', label: '工单', dirs: ['.ai-matrix-team/runtime/workorders/open', '.ai-matrix-team/runtime/workorders/closed'], re: /^WO-.*\.md$/ },
  { kind: 'journal', label: '工单日志', dirs: ['.ai-matrix-team/runtime/workorders/open', '.ai-matrix-team/runtime/workorders/closed'], re: /^WO-.*\.journal\.md$/ },
  { kind: 'dr', label: '决策单', dirs: ['.ai-matrix-team/runtime/decisions/open', '.ai-matrix-team/runtime/decisions/closed'], re: /^DR-.*\.md$/ },
  { kind: 'handoff', label: '交接单', dirs: ['.ai-matrix-team/runtime/handoffs'], re: /.+\.md$/ },
  { kind: 'review', label: '质检报告', dirs: ['.ai-matrix-team/runtime/reviews'], re: /.+\.md$/ },
  { kind: 'log', label: '工作日志', dirs: ['.workbuddy/memory'], re: /^\d{4}-\d{2}-\d{2}\.md$/ },
];
function estimateTokens(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const bytes = Buffer.byteLength(text, 'utf8');
  return Math.round(cjk + (bytes - cjk * 3) / 4);
}
function isoWeek(dstr) {
  const d = new Date(dstr + 'T00:00:00Z');
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear();
  const w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return y + '-W' + String(w).padStart(2, '0');
}
function tokenStats() {
  const files = [];
  for (const spec of TOKEN_KINDS) {
    for (const dir of spec.dirs) {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      for (const f of fs.readdirSync(abs)) {
        if (!spec.re.test(f)) continue;
        const a = path.join(abs, f);
        if (!fs.statSync(a).isFile()) continue;
        const text = fs.readFileSync(a, 'utf8');
        const mdate = spec.kind === 'log' ? f.replace(/\.md$/, '') : fs.statSync(a).mtime.toISOString().slice(0, 10);
        files.push({ kind: spec.kind, label: spec.label, file: f, dir, tokens: estimateTokens(text), bytes: Buffer.byteLength(text, 'utf8'), date: mdate });
      }
    }
  }
  const bucket = (period) => {
    const m = new Map();
    for (const f of files) {
      const key = period === 'day' ? f.date : period === 'week' ? isoWeek(f.date) : f.date.slice(0, 7);
      m.set(key, (m.get(key) || 0) + f.tokens);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([bucket, tokens]) => ({ bucket, tokens }));
  };
  const byKind = TOKEN_KINDS.map((k) => {
    const items = files.filter((f) => f.kind === k.kind);
    return { kind: k.kind, label: k.label, tokens: items.reduce((x, y) => x + y.tokens, 0), files: items.length };
  }).filter((k) => k.files > 0);
  const today = new Date().toISOString().slice(0, 10);
  const last7 = new Set([...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); }));
  // 会话：instances.json（harness 适配层）；会话消费 ≈ 其关联 WO 的主文件+journal+交接单体量
  const sessions = harnessInstances().map((i) => {
    const rel = i.wo ? files.filter((f) => f.file.includes(i.wo)) : [];
    return { session: i.session || (i.role ? i.role + '#' + i.callsign : '#' + i.callsign), callsign: i.callsign, wo: i.wo || null, startedAt: i.startedAt || null, tokens: rel.reduce((x, y) => x + y.tokens, 0) };
  });
  return {
    generatedAt: new Date().toISOString(),
    disclaimer: '按字节估算（CJK≈1 token/字，其余 4 字节/token）· 非宿主侧真实计量',
    total: files.reduce((x, y) => x + y.tokens, 0),
    today: files.filter((f) => f.date === today).reduce((x, y) => x + y.tokens, 0),
    last7: files.filter((f) => last7.has(f.date)).reduce((x, y) => x + y.tokens, 0),
    fileCount: files.length,
    kinds: byKind,
    daily: bucket('day').slice(-60),
    weekly: bucket('week').slice(-12),
    monthly: bucket('month').slice(-12),
    top: [...files].sort((a, b) => b.tokens - a.tokens).slice(0, 8),
    files: files.map((f) => ({ kind: f.kind, label: f.label, file: f.file, date: f.date, tokens: f.tokens })),
    sessions,
  };
}

function openDb() {
  fs.mkdirSync(path.dirname(DB), { recursive: true });
  const db = new DatabaseSync(DB);
  db.exec(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL, title TEXT NOT NULL, body_md TEXT NOT NULL, meta TEXT)`);
  try { db.exec('ALTER TABLE reports ADD COLUMN svg TEXT'); } catch {} // 老库迁移：图形版汇报（v2 起入库）
  return db;
}

/* ---------------- HTTP ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
const json = (res, data) => send(res, 200, JSON.stringify(data));
/** 读取 JSON 请求体（上限 1MB，防呆）。 */
const readBody = (req) => new Promise((resolve, reject) => {
  let b = '';
  req.on('data', (c) => { b += c; if (b.length > 1e6) { reject(new Error('请求体过大')); req.destroy(); } });
  req.on('end', () => resolve(b));
  req.on('error', reject);
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (url.pathname === '/api/profile') return json(res, { team: ABOUT.team, members: ABOUT.members, project: CONFIG.project, terms: CONFIG.terms });
    if (url.pathname === '/api/pipeline') return json(res, pipeline());
    if (url.pathname === '/api/artifacts') return json(res, artifacts());
    if (url.pathname === '/api/tokens') return json(res, tokenStats());
    if (url.pathname === '/api/reports') {
      const db = openDb();
      const rows = db.prepare('SELECT id, created_at, title FROM reports ORDER BY id DESC').all();
      db.close();
      return json(res, rows);
    }
    const m = url.pathname.match(/^\/api\/reports\/(\d+)$/);
    if (m) {
      const db = openDb();
      const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(Number(m[1]));
      db.close();
      return row ? json(res, row) : send(res, 404, JSON.stringify({ error: 'not found' }));
    }
    // 工单/决定原文（创始人需求：点击台账条目右侧抽屉展示）。双目录查找 + id 白名单防穿越。
    const LEDGER_ID = '(?:WO|DR)-\\d{8}-[A-Za-z0-9-]+';
    const woGet = url.pathname.match(new RegExp(`^/api/workorders/(${LEDGER_ID})$`));
    if (woGet && req.method === 'GET') {
      const id = woGet[1];
      for (const sub of ['closed', 'open']) {
        const file = path.join(ROOT, '.ai-matrix-team', 'runtime', 'workorders', sub, `${id}.md`);
        if (fs.existsSync(file)) return json(res, { id, content_md: fs.readFileSync(file, 'utf8') });
      }
      return send(res, 404, JSON.stringify({ error: '工单不存在' }));
    }
    const drGet = url.pathname.match(new RegExp(`^/api/decisions/(${LEDGER_ID})$`));
    if (drGet && req.method === 'GET') {
      const id = drGet[1];
      for (const sub of ['open', 'closed']) {
        const dir = path.join(ROOT, '.ai-matrix-team', 'runtime', 'decisions', sub);
        if (!fs.existsSync(dir)) continue;
        const hit = fs.readdirSync(dir).find((f) => f.startsWith(id) && f.endsWith('.md'));
        if (hit) return json(res, { id, content_md: fs.readFileSync(path.join(dir, hit), 'utf8') });
      }
      return send(res, 404, JSON.stringify({ error: '决定文档不存在' }));
    }
    // DR 批复回填（创始人 2026-10-07）：勾选推荐选项 + 补充说明 → 回写单据「答复」段。
    // 双目录查找（open 优先）+ id 白名单防穿越；无结构化答复段时文末追加，不破坏原文其余部分。
    const drPost = url.pathname.match(new RegExp(`^/api/decisions/(${LEDGER_ID})/verdict$`));
    if (drPost && req.method === 'POST') {
      const id = drPost[1];
      let body;
      try { body = JSON.parse((await readBody(req)) || '{}'); } catch { return send(res, 400, JSON.stringify({ error: '请求体不是合法 JSON' })); }
      const choices = Array.isArray(body.choices) ? body.choices.map(String).filter(Boolean).slice(0, 10) : [];
      const note = String(body.note || '').slice(0, 2000).trim();
      if (!choices.length && !note) return send(res, 400, JSON.stringify({ error: '至少勾选一项结论或填写补充说明' }));
      let hit = null;
      for (const sub of ['open', 'closed']) {
        const dir = path.join(ROOT, '.ai-matrix-team', 'runtime', 'decisions', sub);
        if (!fs.existsSync(dir)) continue;
        const f = fs.readdirSync(dir).find((x) => x.startsWith(id) && x.endsWith('.md'));
        if (f) { hit = path.join(dir, f); break; }
      }
      if (!hit) return send(res, 404, JSON.stringify({ error: '决定文档不存在' }));
      const now = new Date();
      const p2 = (n) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
      const pick = choices.join('；');
      const conclusion = pick + (note ? ` · 其他：${note}` : '');
      const lines = fs.readFileSync(hit, 'utf8').split('\n');
      let patched = false;
      const head = lines.findIndex((l) => /^#{1,4}\s/.test(l) && l.includes('答复'));
      if (head >= 0) {
        let end = lines.length;
        for (let i = head + 1; i < lines.length; i++) if (/^#{1,4}\s/.test(lines[i])) { end = i; break; }
        for (let i = head + 1; i < end; i++) {
          if (/^- 答复人：/.test(lines[i])) { lines[i] = `- 答复人：创始人 · 日期：${dateStr}`; patched = true; }
          else if (/^- 结论：/.test(lines[i])) { lines[i] = `- 结论：${conclusion}`; patched = true; }
          else if (/^- 原文：/.test(lines[i])) { lines[i] = `- 原文：${pick}${note ? ` —— ${note}` : ''}`; patched = true; }
        }
      }
      if (!patched) lines.push('', `## 答复（创始人 · ${dateStr}）`, '', `- 答复人：创始人 · 日期：${dateStr}`, `- 结论：${conclusion}`, `- 原文：${pick}${note ? ` —— ${note}` : ''}`, '');
      fs.writeFileSync(hit, lines.join('\n'));
      return json(res, { ok: true, content_md: lines.join('\n'), file: path.relative(ROOT, hit) });
    }
    // 删除归档工单（创始人需求：防台账文件累积）。双保险：文件名白名单 + 仅限 closed/ 目录。
    const del = url.pathname.match(/^\/api\/workorders\/(WO-\d{8}-[A-Za-z0-9-]+)$/);
    if (del && req.method === 'DELETE') {
      const id = del[1];
      const dir = path.join(ROOT, '.ai-matrix-team', 'runtime', 'workorders', 'closed');
      const file = path.join(dir, `${id}.md`);
      if (!fs.existsSync(file)) return send(res, 404, JSON.stringify({ error: '归档单不存在或已删除' }));
      fs.unlinkSync(file);
      // 同步摘除 INDEX.md 归档行；归档表清空时补占位行
      const idxPath = path.join(ROOT, '.ai-matrix-team', 'runtime', 'workorders', 'INDEX.md');
      if (fs.existsSync(idxPath)) {
        const lines = fs.readFileSync(idxPath, 'utf8').split('\n');
        const kept = lines.filter((l) => !l.startsWith(`| ${id} |`));
        const archStart = kept.findIndex((l) => l.startsWith('## 归档单'));
        let hasRow = false;
        for (let i = archStart; i < kept.length; i++) if (/^\| WO-/.test(kept[i])) { hasRow = true; break; }
        if (!hasRow && archStart >= 0) {
          for (let i = archStart; i < kept.length; i++) {
            if (kept[i].startsWith('|---')) { kept.splice(i + 1, 0, '| （暂无归档单） | | |'); break; }
          }
        }
        fs.writeFileSync(idxPath, kept.join('\n'));
      }
      return json(res, { ok: true, deleted: id });
    }
    // 静态 + SPA 回退
    let rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    let file = path.join(DIST, rel);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    if (!fs.existsSync(file)) return send(res, 503, '<h1>dashboard 未构建</h1><p>先在 .skills/dashboard 下执行 pnpm build。</p>', 'text/html; charset=utf-8');
    const ext = path.extname(file);
    // 本地控制台：静态响应一律 no-store（创始人 2026-10-06 指示「关闭 dashboard 缓存」）——
    // 改完刷新即生效，杜绝「刷新不生效」复发；/api/* 的 send() 本已 no-store。
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    return fs.createReadStream(file).pipe(res);
  } catch (e) {
    return send(res, 500, JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`OK ${url}`);
  console.log(`   项目：${CONFIG.project.name} · 台账：<project>/.ai-matrix-team/runtime · 汇报库：${path.relative(ROOT, DB)}`);
});
