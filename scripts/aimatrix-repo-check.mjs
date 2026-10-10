#!/usr/bin/env node
// aimatrix-repo-check · 团队仓自检门禁（把「整洁 + 三层 + 链接」纪律变成退出码）
//
// 检查项：
//   ① 技能 frontmatter：全部 aimatrix-*/SKILL.md 可解析、name/description 非空、name 与目录一致
//   ② 三层阈值：岗位 SKILL ≤5KB、角色 md ≤3KB（charter §4A.5）
//   ③ references 完整性：SKILL.md 里引用的相对路径存在
//   ④ 修订痕迹：代码/文档不得留 WO 号、日期括注、vX.Y 版本括注、过程用语（台账/模板/specs 豁免）
//   ⑤ 文档内链：docs/*.md 与 SKILL.md 中的相对 md 链接可解析
//
// 用法：node <team-repo>/scripts/aimatrix-repo-check.mjs [--quiet]
// 退出码：0 全过 / 1 有违规

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const quiet = process.argv.includes('--quiet');

const SKILL_MAX = 5 * 1024;
const MEMBER_MAX = 3.5 * 1024;

const violations = [];
const add = (kind, file, msg) => violations.push({ kind, file, msg });

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const size = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };
const ls = (d) => { try { return fs.readdirSync(d); } catch { return []; } };

const skillDirs = ls(ROOT).filter((d) => /^aimatrix-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory());

// ① frontmatter
const frontmatterOf = (raw) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return fm;
};

for (const d of skillDirs) {
  const p = path.join(ROOT, d, 'SKILL.md');
  if (!exists(p)) { add('frontmatter', `${d}/SKILL.md`, '缺文件'); continue; }
  const raw = read(p);
  const fm = frontmatterOf(raw);
  if (!fm) { add('frontmatter', `${d}/SKILL.md`, 'frontmatter 缺失或格式错误'); }
  else {
    if (!fm.name) add('frontmatter', `${d}/SKILL.md`, '缺 name');
    else if (fm.name !== d) add('frontmatter', `${d}/SKILL.md`, `name「${fm.name}」与目录名不一致`);
    if (!fm.description) add('frontmatter', `${d}/SKILL.md`, '缺 description');
  }
  // ② 阈值
  if (size(p) > SKILL_MAX) add('threshold', `${d}/SKILL.md`, `${(size(p) / 1024).toFixed(1)}KB > 5KB（细则请入 references/）`);
  // ③ references 相对路径
  for (const m of raw.matchAll(/\]\((\.{0,2}\/?[^)#\s]+\.md)\)/g)) {
    const target = m[1];
    if (/^https?:/.test(target)) continue;
    const resolved = path.resolve(path.dirname(p), target);
    if (!exists(resolved)) add('link', `${d}/SKILL.md`, `引用不存在：${target}`);
  }
}

for (const f of ls(path.join(ROOT, 'members')).filter((f) => f.endsWith('.md'))) {
  const p = path.join(ROOT, 'members', f);
  if (size(p) > MEMBER_MAX) add('threshold', `members/${f}`, `${(size(p) / 1024).toFixed(1)}KB > 3KB（只留身份/铁律/红线，目标 3.5KB）`);
}

// ④ 修订痕迹（豁免：台账、模板、specs 文件名、examples 的演示文本）
const TRACE = [
  [/\bWO-20\d{6}\b/, 'WO 号残留'],
  [/\b20\d\d-\d\d-\d\d\b/, '日期括注残留'],
  [/\bv1\.\d\b/, '版本括注残留'],
  [/(?<!本轮)Phase B/, '过程用语残留'],
  [/本轮(?!闭环)/, '过程用语残留'],
];
const exempt = (rel) =>
  rel.startsWith('.ai-matrix-team/') ||
  rel.startsWith('docs/templates/') ||
  rel.startsWith('docs/specs/') ||
  rel.startsWith('dashboard/data/') ||
  rel.startsWith('node_modules/') ||
  rel === 'scripts/aimatrix-repo-check.mjs' ||        // 本文件自带规则字面量
  rel === 'promo-page/assets/sponsor-embed.js' ||      // 由 iskill-generate-sponsors 生成（含生成时间）
  /(^|\/)(\.git|dist)\//.test(rel);

const walkFiles = (dir, depth = 0, out = []) => {
  if (depth > 5) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'browsers', '.workbuddy'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, depth + 1, out);
    else out.push(p);
  }
  return out;
};

for (const p of walkFiles(ROOT)) {
  const rel = path.relative(ROOT, p);
  if (exempt(rel)) continue;
  if (!/\.(md|mjs|js|ts|tsx|css|html|svg|json|sh|command)$/.test(p)) continue;
  let raw;
  try { raw = read(p); } catch { continue; }
  raw.split('\n').forEach((line, i) => {
    if (rel.endsWith('.html') && /<(p|span|div|li|td)[^>]*>[^<]*(WO-20|20\d\d-\d\d-\d\d)/.test(line)) return; // 演示稿正文
    if (line.includes('../../')) return; // 项目侧视角链接（写给目标项目的相对路径）
    for (const [re, label] of TRACE) {
      if (re.test(line)) { add('trace', `${rel}:${i + 1}`, `${label}：${line.trim().slice(0, 70)}`); break; }
    }
  });
}

// ⑤ 文档内链（docs/*.md 与 index）
for (const p of [...ls(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => path.join(ROOT, 'docs', f)),
  ...ls(path.join(ROOT, 'docs', 'index')).filter((f) => f.endsWith('.md')).map((f) => path.join(ROOT, 'docs', 'index', f))]) {
  const raw = read(p);
  const rel = path.relative(ROOT, p);
  for (const m of raw.matchAll(/\]\((\.{0,2}\/?[^)#\s]*?\.md)\)/g)) {
    const target = m[1];
    if (/^https?:/.test(target) || target.includes('../../')) continue;
    if (!exists(path.resolve(path.dirname(p), target))) add('link', rel, `引用不存在：${target}`);
  }
}

// ⑥ CSS 注释配对：注释正文里混入 `*/` 会提前收尾，把紧随其后的整条规则吞掉
// （实测：一处 `--n-*/--brand` 曾吞掉 :root 浅色令牌块与该段 43% 样式，浅色主题静默降级）
for (const p of walkFiles(ROOT)) {
  if (!/\.css$/.test(p)) continue;
  const rel = path.relative(ROOT, p);
  let raw;
  try { raw = read(p); } catch { continue; }
  const open = (raw.match(/\/\*/g) || []).length;
  const close = (raw.match(/\*\//g) || []).length;
  if (open !== close) add('csscomment', rel, `注释未配对：/* ${open} 个 vs */ ${close} 个——注释里混入 */ 会提前收尾，吞掉紧随其后的规则`);
}

// ---------- 报告 ----------
const byKind = violations.reduce((a, v) => ({ ...a, [v.kind]: (a[v.kind] || 0) + 1 }), {});
const label = { frontmatter: '技能 frontmatter', threshold: '三层阈值', link: '链接有效性', trace: '修订痕迹', csscomment: 'CSS 注释配对' };

if (!violations.length) {
  console.log(`✓ 团队仓自检全过（${skillDirs.length} 个岗位技能、${ls(path.join(ROOT, 'members')).filter((f) => f.endsWith('.md')).length} 个角色定义）`);
  process.exit(0);
}

console.error(`✗ 团队仓自检发现 ${violations.length} 处违规：${Object.entries(byKind).map(([k, n]) => `${label[k] || k} ${n}`).join(' · ')}`);
const shown = quiet ? violations.slice(0, 10) : violations;
for (const v of shown) console.error(`  [${label[v.kind] || v.kind}] ${v.file} — ${v.msg}`);
if (quiet && violations.length > shown.length) console.error(`  …另有 ${violations.length - shown.length} 处`);
process.exit(1);
