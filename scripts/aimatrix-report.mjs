#!/usr/bin/env node
/**
 * aimatrix-report.mjs — 产研高级总监「汇报模式」生成器（文字版 + 图形版）
 *
 * 汇总门禁状态 / 活跃工单 / 待拍板 / 最近巡检 / git 近况，
 * 用大白话（project.json 的 terms 术语表）生成一份汇报：
 * ① 文字版（Markdown，四段式）→ SQLite reports.body_md
 * ② 图形版（SVG 信息图，四区块 + 金句）→ SQLite reports.svg + data/reports/report-<id>.svg
 *
 * 用法：node <team-repo>/scripts/aimatrix-report.mjs [--root <repo>]
 * 退出码：0 成功
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { redact } from './aimatrix-redact.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const getArg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const ROOT = (() => {
  const given = getArg('--root') || getArg('--project');
  if (given) return path.resolve(given);
  // 从脚本位置向上找最近的 .ai-matrix-team（含 config.json 或 project.json）——兼容两种布局：
  // 目标项目 <project>/.ai-matrix-team/scripts/ 与团队仓 <repo>/scripts/
  let d = __dirname;
  for (let i = 0; i < 6; i++) {
    const m = path.join(d, '.ai-matrix-team');
    if (fs.existsSync(path.join(m, 'config.json')) || fs.existsSync(path.join(m, 'project.json'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return path.resolve(__dirname, '..');
})();

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const rel = (p) => path.relative(ROOT, p);

// ---------- 项目档案 ----------
// config.json（aimatrix-init 生成）优先；团队仓自身只有 project.json（字段为其超集）→ 回退
const CONFIG_PATH = exists('.ai-matrix-team/config.json')
  ? path.join(ROOT, '.ai-matrix-team', 'config.json')
  : path.join(ROOT, '.ai-matrix-team', 'project.json');
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const T = cfg.terms || {};
const lbl = (k, fallback) => T[k]?.label || fallback;
const WO_LABEL = lbl('wo', '工单');
const DR_LABEL = lbl('dr', '待拍板');
const LOCK_LABEL = lbl('lock', '占用');

// ---------- 台账解析 ----------
function activeWorkorders() {
  const idx = path.join(ROOT, '.ai-matrix-team', 'runtime', 'workorders', 'INDEX.md');
  if (!fs.existsSync(idx)) return [];
  const table = read('.ai-matrix-team/runtime/workorders/INDEX.md');
  // 只解析活跃表：取「## 归档单」分界之前的内容（INDEX 无「## 活跃单」标题，避免归档行混入）
  const section = table.split(/^## 归档单/m)[0];
  if (!section) return [];
  const rows = [];
  for (const line of section.split('\n')) {
    if (!/^\| WO-/.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c !== '');
    if (cells[0] === '（暂无活跃单）') continue;
    rows.push({ id: cells[0], purpose: cells[2] || '', executor: cells[3] || '', status: cells[7] || '' });
  }
  return rows;
}

function archivedWorkorders() {
  const dir = path.join(ROOT, '.ai-matrix-team', 'runtime', 'workorders', 'closed');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.startsWith('WO-') && f.endsWith('.md')).map((f) => {
    const text = read(path.join('.ai-matrix-team/runtime/workorders/closed', f));
    const one = text.split(/^## 1\. 目的与背景/m)[1]?.split('\n').map((s) => s.trim()).find(Boolean) || '';
    return { id: f.replace(/\.md$/, ''), purpose: one.replace(/^# /, '').slice(0, 60) };
  });
}

function openDecisions() {
  // D3：实时扫 decisions/open/ 目录——LEDGER 仅 ledger-sync 时重建，并发会话新落的 DR 会漏
  const dir = path.join(ROOT, '.ai-matrix-team', 'runtime', 'decisions', 'open');
  if (!fs.existsSync(dir)) return [];
  const rows = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/^DR-\d{8}-\d{3}.*\.md$/.test(f)) continue;
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const field = (n) => (text.match(new RegExp('\\|\\s*\\*{0,2}' + n + '\\*{0,2}\\s*\\|\\s*([^|]*?)\\s*\\|')) || [])[1];
    const id = (f.match(/DR-\d{8}-\d{3}/) || [f])[0];
    const status = (field('状态') || 'OPEN').replace(/`/g, '').trim();
    if (!/OPEN/i.test(status)) continue;
    const bl = field('阻塞级别') || '';
    const title = (text.match(/^#\s+(.+)$/m) || [, ''])[1].replace(new RegExp('^' + id + '\\s*·\\s*'), '');
    rows.push({ id, oneLine: title, blocking: /BLOCKING/i.test(bl) && !/NON/i.test(bl), due: field('期限') || '' });
  }
  return rows;
}

function lockState() {
  const f = path.join(ROOT, '.ai-matrix-team', 'runtime', 'state', 'lock.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

/**
 * 锁状态归一（面域分片：lock.json 可含多个 holder）。
 * holders[] → {busy:true, count, holders:[{wo,since}], primary}
 * legacy 单 holder → count:1
 * 无锁 → {busy:false, count:0}
 * 供 compose / renderSvg 使用：N≥2 必须列出全部在持单，不得只显主 holder、不得显空闲。
 */
function lockView(l) {
  if (!l || typeof l !== 'object') return { busy: false, count: 0, holders: [] };
  const arr = Array.isArray(l.holders) && l.holders.length
    ? l.holders.map((h) => ({ wo: h.wo || h.holder, since: h.acquiredAt }))
    : (l.holder ? [{ wo: l.holder, since: l.acquiredAt }] : []);
  const holders = arr.filter((h) => h.wo);
  if (!holders.length) return { busy: false, count: 0, holders: [] };
  return { busy: true, count: holders.length, holders, primary: holders[0] };
}

function latestInspection() {
  const dir = path.join(ROOT, '.ai-matrix-team', 'runtime', 'reviews');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.includes('巡检') && f.endsWith('.md')).sort();
  if (!files.length) return null;
  const text = read(path.join('.ai-matrix-team/runtime/reviews', files.at(-1)));
  // 只取「小结」所在行的计数，避免表格内容串行
  const summaryLine = text.split('\n').find((l) => l.includes('小结') && /PASS|WARN|FAIL/i.test(l)) || '';
  return { file: files.at(-1), summary: summaryLine.replace(/^#+\s*/, '').trim().slice(0, 120) };
}

function gitLog(since) {
  try {
    const args = since
      ? ['log', `--since=${since}`, '--pretty=- %h %s', '-20']
      : ['log', '--pretty=- %h %s', '-8'];
    return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim();
  } catch { return '（git 不可用）'; }
}

/**
 * D5：§4 建议默认值多行渲染——取 §4 区块内 blockquote 行合成单行；
 * 只在 §4 内找「按默认」，防叙述/表格里的「按默认执行） |」被截成乱码。
 */
function drAdvice(text) {
  const sec = text.split(/^##\s*4\..*$/m)[1]?.split(/^##\s/m)[0] || '';
  const quotes = sec.split('\n')
    .filter((l) => /^>/.test(l.trim()))
    .map((l) => l.replace(/^>\s?/, '').trim())
    .filter(Boolean);
  let out = quotes.join(' ');
  if (!out) {
    const def = sec.match(/按默认[^\n]*/)?.[0] || '';
    out = def.replace(/^按默认[「"]?|」?"?$/g, '');
  }
  return out.replace(/\s*\|\s*/g, ' · ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function findDecisionFile(id) {
  for (const sub of ['open', 'closed']) {
    const dir = path.join(ROOT, '.ai-matrix-team', 'runtime', 'decisions', sub);
    if (!fs.existsSync(dir)) continue;
    const hit = fs.readdirSync(dir).find((f) => f.startsWith(id));
    if (hit) return path.join('.ai-matrix-team/runtime/decisions', sub, hit);
  }
  return null;
}

// ---------- 结构化数据（文字版与图形版共用） ----------
function collect() {
  const wos = activeWorkorders();
  const drs = openDecisions();
  const lock = lockState();
  const inspect = latestInspection();
  const commitText = gitLog(getLastReportTime());
  const commits = commitText.startsWith('- ')
    ? commitText.split('\n').filter((l) => l.startsWith('- ')).map((l) => {
        const m = l.match(/^- ([0-9a-f]+) (.*)$/);
        return m ? { hash: m[1], subject: m[2] } : { hash: '', subject: l.slice(2) };
      })
    : [];
  const closed = archivedWorkorders().slice(-3).reverse(); // 最新办结在前
  const decisions = drs.map((d) => {
    let advice = '';
    const file = findDecisionFile(d.id);
    if (file) {
      const text = read(file);
      advice = drAdvice(text); // D5：§4 区块内多行渲染，防表格「按默认执行） |」截断乱码
    }
    return { ...d, advice };
  });
  const plan = [];
  if (drs.some((d) => d.blocking)) plan.push(`先等您拍板（第④段有清单）——不拍板的事不往前推，这是规矩。`);
  if (wos.length) plan.push(`把进行中的${WO_LABEL}干完并验收：${wos.map((w) => w.id).join('、')}。`);
  if (inspect?.summary && /FAIL/i.test(inspect.summary)) plan.push(`处理体检发现的问题（❌ 项），开整改${WO_LABEL}派Bruce修。`);
  plan.push('里程碑后照常跑合规体检；月度例行体检在月初。');
  return { generatedAt: new Date(), wos, closed, commits, lock, inspect, drs, decisions, plan };
}

// ---------- 大白话文字版 ----------
function compose(d) {
  const lines = [];
  const lv = lockView(d.lock);
  lines.push(`# ${cfg.project.name} · 专家团工作汇报`);
  lines.push(`> 生成时间：${d.generatedAt.toLocaleString('zh-CN', { hour12: false })} · 汇报人：PC（产研高级总监）\n`);

  // ① 最近干成了什么
  lines.push('## ✅ 最近干成了什么');
  if (d.commits.length) lines.push('**代码进展**：', d.commits.map((c) => `- ${c.hash} ${c.subject}`).join('\n'), '');
  if (d.closed.length) {
    lines.push(`**办结的${WO_LABEL}**：`);
    for (const w of d.closed) lines.push(`- ${w.id} — ${w.purpose}`);
    lines.push('');
  }
  if (!d.commits.length && !d.closed.length) lines.push('（台账与代码近况里没有新进展——要么确实没有新任务，要么上次汇报后没动工。）\n');

  // ② 现在正在干 / 卡在哪
  lines.push('## ⏳ 现在正在干 / 卡在哪');
  if (d.wos.length) {
    for (const w of d.wos) lines.push(`- 进行中的${WO_LABEL}：**${w.id}**（${w.purpose}）—— 当前状态：${w.status}`);
  } else {
    lines.push(`- 没有进行中的${WO_LABEL}，施工队列是空的。`);
  }
  lines.push(`- 公共区域${LOCK_LABEL}状态：${lv.busy
    ? (lv.count === 1
      ? `**被 ${lv.primary.wo} 占用中**`
      : `**被 ${lv.holders.map((h) => h.wo).join('、')} 共 ${lv.count} 单占用中**`)
    : '空闲，随时可以开工'}`);
  if (d.drs.length) {
    lines.push(`- **有 ${d.drs.length} 件事等您拍板**（详见最后一段）。`);
  } else {
    lines.push(`- 没有等您拍板的事，一切顺畅。`);
  }
  if (d.inspect) lines.push(`- 最近一次合规体检：${d.inspect.file}${d.inspect.summary ? ` — ${d.inspect.summary}` : ''}`);
  lines.push('');

  // ③ 接下来的计划
  lines.push('## 🗺️ 接下来的计划');
  lines.push(...d.plan.map((p, i) => `${i + 1}. ${p}`), '');

  // ④ 需要您定的事
  lines.push('## 🙋 需要您定的事');
  if (!d.decisions.length) {
    lines.push('没有。您该忙忙，有需要拍板的我会带着选项来找您。');
  } else {
    for (const x of d.decisions) {
      lines.push(`- **${x.oneLine}**（编号 ${x.id}${x.blocking ? '，⏸️ 不定下来相关工作就停着' : ''}${x.due ? `，建议期限 ${x.due}` : ''}）`);
      if (x.advice) lines.push(`  - 我的建议：${x.advice}。回「按默认」即可。`);
    }
  }
  return lines.join('\n');
}

// ---------- SVG 图形版（样张：黄昏小院信息图风格） ----------
const varWrap = (name, fb) => `var(--rp-${name}, ${fb})`;
// 全部走 --rp-* CSS 变量（styles.css 三段主题），inline 嵌入 dashboard 时随主题自动暗黑；fallback 为浅色值（独立文件查看）
const C = {
  bgTop: varWrap('bg-top', '#FDF8F3'), bgBottom: varWrap('bg-bottom', '#F3E3D2'), ink: varWrap('ink', '#1C1917'), muted: varWrap('muted', '#78716C'),
  line: varWrap('line', '#E7D5C0'), card: varWrap('card', '#FFFFFF'), cardStroke: varWrap('card-stroke', '#F0DCC6'),
  accent: varWrap('accent', '#C2410C'), bannerText: varWrap('banner-text', '#FCD9A8'),
  bannerBg: varWrap('banner-bg', '#1C1917'), decideBg: varWrap('decide-bg', '#FFFBF5'), decideStroke: varWrap('decide-stroke', '#FFC97A'),
  greenBg: varWrap('green-bg', '#ECFDF5'), greenStroke: varWrap('green-stroke', '#A7F3D0'), greenBar: varWrap('green-bar', '#10B981'), greenText: varWrap('green-text', '#047857'),
  amberBg: varWrap('amber-bg', '#FEF3C7'), amberStroke: varWrap('amber-stroke', '#FDE68A'), amberBar: varWrap('amber-bar', '#F59E0B'), amberText: varWrap('amber-text', '#92400E'),
  orangeBg: varWrap('orange-bg', '#FFEDD5'), orangeStroke: varWrap('orange-stroke', '#FED7AA'), orangeBar: varWrap('orange-bar', '#EA580C'), orangeText: varWrap('orange-text', '#C2410C'),
  blueBg: varWrap('blue-bg', '#EFF6FF'), blueStroke: varWrap('blue-stroke', '#BFDBFE'), blueBar: varWrap('blue-bar', '#3B82F6'), blueText: varWrap('blue-text', '#1D4ED8'),
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 图形版专用：洗掉台账里的 Markdown 痕迹（**加粗**、`代码`、# 标题符）
const plain = (s) => String(s).replace(/\*\*/g, '').replace(/`/g, '').replace(/^#+\s*/, '').trim();
const charW = (ch, fs) => (ch.charCodeAt(0) > 0xFF ? fs : fs * 0.56); // CJK 全宽、ASCII 窄
const textW = (s, fs) => [...s].reduce((w, ch) => w + charW(ch, fs), 0);
function fit(s, maxW, fs) {
  if (textW(s, fs) <= maxW) return s;
  let w = 0, out = '';
  for (const ch of s) {
    if (w + charW(ch, fs) > maxW - fs) return out + '…';
    out += ch; w += charW(ch, fs);
  }
  return out;
}
function wrap(s, maxW, fs, maxLines) {
  const lines = [];
  let cur = '', w = 0;
  for (const ch of s) {
    if (w + charW(ch, fs) > maxW) {
      lines.push(cur);
      if (lines.length === maxLines) { lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; return lines; }
      cur = ''; w = 0;
    }
    cur += ch; w += charW(ch, fs);
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}
const txt = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-size="${o.fs || 12.5}"${o.weight ? ` font-weight="${o.weight}"` : ''} fill="${o.fill || C.ink}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 10}" fill="${o.fill || C.card}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1.5}"` : ''}${o.opacity ? ` opacity="${o.opacity}"` : ''}/>`;

function renderSvg(d) {
  const parts = [];
  const lv = lockView(d.lock);
  let y = 0;
  const PAD = 24, W = 1100, X = 0, CW = W; // 画布 = 内容宽 W + 左右各 PAD；内容坐标从 0 起，左留白由外层 <g> 平移提供（不可再用 X=PAD，否则左留白被算两遍 → 左 48 / 右 0）

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + PAD * 2} ${'H'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif">`);
  parts.push(`<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${C.bgTop}"/><stop offset="100%" stop-color="${C.bgBottom}"/></linearGradient></defs>`);
  parts.push(`<rect width="${W + PAD * 2}" height="${'H'}" fill="url(#bg)"/>`);
  parts.push(`<g transform="translate(${PAD},${PAD})">`);

  // ── 顶部标题 + 状态徽章 ──
  parts.push(txt(X, y + 30, `${cfg.project.name} · 专家团工作汇报`, { fs: 25, weight: 700 }));
  parts.push(txt(X, y + 54, `${d.generatedAt.toLocaleString('zh-CN', { hour12: false })} · 汇报人：PC（产研高级总监） · 大白话图形版`, { fs: 13, fill: C.muted }));
  y += 84;

  const chip = (label, style) => {
    const w = textW(label, 12) + 26;
    parts.push(rect(X2, y, w, 26, { fill: style.bg, stroke: style.stroke, sw: 1, rx: 13 }));
    parts.push(txt(X2 + w / 2, y + 17.5, label, { fs: 12, fill: style.text, anchor: 'middle', weight: 600 }));
    X2 += w + 10;
  };
  let X2 = X;
  const insp = d.inspect ? (/FAIL/i.test(d.inspect.summary) ? ['体检 ❌ 有问题', C.orangeBg, C.orangeStroke, C.orangeText]
    : /WARN/i.test(d.inspect.summary) ? ['体检 ⚠️ 有提醒', C.amberBg, C.amberStroke, C.amberText]
    : ['体检 ✅ 通过', C.greenBg, C.greenStroke, C.greenText]) : null;
  chip(`在办${WO_LABEL} ${d.wos.length}`, { bg: C.blueBg, stroke: C.blueStroke, text: C.blueText });
  chip(`等您拍板 ${d.drs.length}`, d.drs.length ? { bg: C.orangeBg, stroke: C.orangeStroke, text: C.orangeText } : { bg: C.greenBg, stroke: C.greenStroke, text: C.greenText });
  chip(lv.busy ? (lv.count === 1 ? '公共区域 占用中' : `公共区域 占用中·${lv.count}单`) : '公共区域 空闲', lv.busy ? { bg: C.amberBg, stroke: C.amberStroke, text: C.amberText } : { bg: C.greenBg, stroke: C.greenStroke, text: C.greenText });
  if (insp) chip(insp[0], { bg: insp[1], stroke: insp[2], text: insp[3] });
  y += 42;

  const section = (title) => {
    y += 32; // WO-06：序号标题统一 +32px 上边距
    parts.push(txt(X, y, title, { fs: 15, weight: 700, fill: C.accent }));
    parts.push(`<line x1="${X + textW(title, 15) + 16}" y1="${y - 5}" x2="${X + W}" y2="${y - 5}" stroke="${C.line}" stroke-width="1"/>`);
    y += 26;
  };

  // ── ① 最近干成了什么 ──
  section('① 最近干成了什么');
  if (d.closed.length) {
    const gap = 20, cardW = (W - gap * 2) / 3;
    d.closed.slice(0, 3).forEach((w, i) => {
      const cx = X + i * (cardW + gap);
      parts.push(rect(cx, y, cardW, 108, { fill: C.card, stroke: C.cardStroke }));
      parts.push(`<circle cx="${cx + 28}" cy="${y + 30}" r="11" fill="${C.greenBg}" stroke="${C.greenStroke}" stroke-width="1.5"/>`);
      parts.push(txt(cx + 28, y + 34.5, '✓', { fs: 12, fill: C.greenText, anchor: 'middle', weight: 700 }));
      parts.push(txt(cx + 48, y + 34.5, fit(w.id.replace(/^WO-\d+-/, ''), cardW - 68, 13.5), { fs: 13.5, weight: 600 }));
      wrap(plain(w.purpose), cardW - 44, 11.5, 2).forEach((l, j) => parts.push(txt(cx + 20, y + 62 + j * 18, l, { fs: 11.5, fill: C.muted })));
    });
    y += 124;
  }
  if (d.commits.length) {
    const rows = d.commits.slice(0, 5);
    const h = 48 + rows.length * 26;
    parts.push(rect(X, y, CW, h, { fill: C.card, stroke: C.cardStroke }));
    parts.push(rect(X, y, 6, h, { fill: C.greenBar, rx: 3 }));
    parts.push(txt(X + 24, y + 26, `代码近况 · 上次汇报以来 ${d.commits.length} 笔提交`, { fs: 13, weight: 700, fill: C.greenText }));
    rows.forEach((c, i) => parts.push(txt(X + 24, y + 52 + i * 26, `· ${c.hash}  ${fit(c.subject, CW - 70, 12)}`, { fs: 12 })));
    y += h + 14;
  }
  if (!d.closed.length && !d.commits.length) {
    parts.push(rect(X, y, CW, 40, { fill: C.card, stroke: C.cardStroke }));
    parts.push(txt(X + 24, y + 25, '台账与代码近况里没有新进展——要么确实没有新任务，要么上次汇报后没动工。', { fs: 12, fill: C.muted }));
    y += 56;
  }
  y += 10;

  // ── ② 正在干 / 卡在哪 ──
  section('② 正在干 / 卡在哪');
  const row = (text, style, tag) => {
    parts.push(rect(X, y, CW, 36, { fill: style.bg, stroke: style.stroke, sw: 1, rx: 8 }));
    parts.push(rect(X, y, 6, 36, { fill: style.bar, rx: 3 }));
    parts.push(txt(X + 24, y + 23, fit(text, CW - (tag ? textW(tag, 11) + 70 : 50), 12.5), { fs: 12.5, fill: style.text }));
    if (tag) parts.push(txt(X + W - 16, y + 23, tag, { fs: 11, fill: style.text, anchor: 'end', weight: 600 }));
    y += 42;
  };
  if (d.wos.length) {
    for (const w of d.wos) row(`在办：${w.id} — ${plain(w.purpose)}`, { bg: C.greenBg, stroke: C.greenStroke, bar: C.greenBar, text: C.greenText }, w.executor || w.status);
  } else {
    row(`没有进行中的${WO_LABEL}，施工队列是空的。`, { bg: C.card, stroke: C.cardStroke, bar: C.blueBar, text: C.muted });
  }
  row(lv.busy
    ? (lv.count === 1
      ? `公共区域被 ${lv.primary.wo} 占用中`
      : `公共区域被 ${lv.holders.map((h) => h.wo).join('、')} 共 ${lv.count} 单占用中`)
    : `公共区域${LOCK_LABEL}：空闲，随时可以开工`,
    lv.busy ? { bg: C.amberBg, stroke: C.amberStroke, bar: C.amberBar, text: C.amberText } : { bg: C.greenBg, stroke: C.greenStroke, bar: C.greenBar, text: C.greenText },
    lv.busy ? (lv.count === 1 ? '占用中' : `${lv.count}单在持`) : '可开工');
  row(d.drs.length ? `有 ${d.drs.length} 件事等您拍板（见第④段）` : '没有等您拍板的事，一切顺畅',
    d.drs.length ? { bg: C.orangeBg, stroke: C.orangeStroke, bar: C.orangeBar, text: C.orangeText } : { bg: C.greenBg, stroke: C.greenStroke, bar: C.greenBar, text: C.greenText });
  if (d.inspect) {
    const s = /FAIL/i.test(d.inspect.summary) ? { bg: C.orangeBg, stroke: C.orangeStroke, bar: C.orangeBar, text: C.orangeText }
      : /WARN/i.test(d.inspect.summary) ? { bg: C.amberBg, stroke: C.amberStroke, bar: C.amberBar, text: C.amberText }
      : { bg: C.greenBg, stroke: C.greenStroke, bar: C.greenBar, text: C.greenText };
    row(`最近一次合规体检：${fit(d.inspect.summary || d.inspect.file, CW - 60, 12.5)}`, s, '合规体检');
  }
  y += 10;

  // ── ③ 接下来的计划 ──
  section('③ 接下来的计划');
  d.plan.forEach((p, i) => {
    parts.push(rect(X, y, CW, 34, { fill: C.card, stroke: C.cardStroke, sw: 1, rx: 8 }));
    parts.push(`<circle cx="${X + 24}" cy="${y + 17}" r="10" fill="${C.orangeBg}" stroke="${C.orangeStroke}" stroke-width="1"/>`);
    parts.push(txt(X + 24, y + 21, String(i + 1), { fs: 11.5, fill: C.orangeText, anchor: 'middle', weight: 700 }));
    parts.push(txt(X + 44, y + 21.5, fit(plain(p), CW - 64, 12.5), { fs: 12.5 }));
    y += 40;
  });
  y += 10;

  // ── ④ 需要您定的事 ──
  section('④ 等您拍板');
  if (!d.decisions.length) {
    row('没有。您该忙忙，有需要拍板的我会带着选项来找您。', { bg: C.greenBg, stroke: C.greenStroke, bar: C.greenBar, text: C.greenText }, '一切顺畅');
  } else {
    for (const x of d.decisions) {
      const adviceLine = x.advice ? `我的建议：${plain(x.advice)} · 回「按默认」即可` : '等您一句话定方向。';
      const meta = [`编号 ${x.id}`, x.blocking ? '⏸ 不拍板相关工作就停着' : '', x.due ? `建议期限 ${x.due}` : ''].filter(Boolean).join(' · ');
      const h = 66;
      parts.push(rect(X, y, CW, h, { fill: C.decideBg, stroke: C.decideStroke, sw: 2, rx: 12 }));
      parts.push(txt(X + 24, y + 26, `❋ ${fit(plain(x.oneLine), CW - 200, 13)}`, { fs: 13, weight: 700 }));
      parts.push(txt(X + W - 24, y + 26, meta, { fs: 11, fill: C.accent, anchor: 'end', weight: 600 }));
      parts.push(txt(X + 24, y + 50, fit(adviceLine, CW - 48, 11.5), { fs: 11.5, fill: C.muted }));
      y += h + 10;
    }
  }

  // 金句收尾：底色用 banner-bg（两种主题下都保持深底），文字用 banner-text 暖琥珀
  y += 8;
  parts.push(rect(X, y, CW, 38, { fill: C.bannerBg, rx: 0 }));
  parts.push(txt(W / 2, y + 24.5, '真正管住 AI 的不是规则条文，而是每件事有人负责、每个岔路口有人拍板。', { fs: 13, fill: C.bannerText, anchor: 'middle', weight: 600 }));
  y += 38;

  const H = y + PAD * 2;
  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('\n').replaceAll('"0 0 1148 H"', `"0 0 ${W + PAD * 2} ${H}"`).replaceAll('height="H"', `height="${H}"`);
}

// ---------- SQLite ----------
// 汇报库按项目分文件：<团队仓>/dashboard/data/db/<project-slug>.db
// （此前是全局单例 dashboard/data/dashboard.db，多项目会互相覆盖；且旧实现把绝对路径拼进 path.join，写到了歪目录）
const TEAM_ROOT = path.resolve(__dirname, '..');
const DB_DIR = path.join(TEAM_ROOT, 'dashboard', 'data', 'db');
const slug = String(cfg.project?.name || 'project').replace(/[^\w.-]+/g, '-');
const DB_PATH = path.join(DB_DIR, `${slug}.db`);
const LEGACY_DB = path.join(TEAM_ROOT, 'dashboard', 'data', 'dashboard.db');
// 一次性迁移：本项目的分库不存在但旧单例库在 → 拷贝过来（保留历史汇报）
if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.copyFileSync(LEGACY_DB, DB_PATH);
  console.log(`（已从旧单例库迁移历史汇报 → ${path.relative(TEAM_ROOT, DB_PATH)}）`);
}

function getLastReportTime() {
  if (!fs.existsSync(DB_PATH)) return null;
  const db = new DatabaseSync(DB_PATH);
  const row = db.prepare('SELECT created_at FROM reports ORDER BY id DESC LIMIT 1').get();
  db.close();
  return row?.created_at || null;
}

function saveReport(title, bodyMd, svg) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    title TEXT NOT NULL,
    body_md TEXT NOT NULL,
    meta TEXT
  )`);
  try { db.exec('ALTER TABLE reports ADD COLUMN svg TEXT'); } catch {} // 老库迁移（列已存在则忽略）
  const info = db.prepare('INSERT INTO reports (created_at, title, body_md, meta, svg) VALUES (?, ?, ?, ?, ?)')
    .run(new Date().toISOString(), title, bodyMd, JSON.stringify({ project: cfg.project.name, generator: 'aimatrix-report.mjs v2' }), svg);
  db.close();
  return Number(info.lastInsertRowid);
}

// ---------- main ----------
const data = collect();
// 脱敏：汇报会入库/落盘/分享（public 项目尤其），密钥/本机路径/邮箱出机器前必须洗掉
const body = redact(compose(data), { root: ROOT });
const svg = redact(renderSvg(data), { root: ROOT });
const title = `汇报 · ${data.generatedAt.toLocaleDateString('zh-CN')} · ${cfg.project.name}`;
const id = saveReport(title, body, svg);

// 图形版同步落文件（便于直接分享/嵌文档）
const svgDir = path.join(DB_DIR, 'reports');
fs.mkdirSync(svgDir, { recursive: true });
const svgPath = path.join(svgDir, `report-${id}.svg`);
fs.writeFileSync(svgPath, svg);

console.log(body);
console.log(`\n---\n📦 已入库：dashboard.db → reports #${id}（文字版 + 图形版，dashboard 汇报页默认展示图形版）`);
console.log(`🖼️  图形版已落盘：${rel(svgPath)}`);
