#!/usr/bin/env node
/**
 * aimatrix-preflight.mjs — 升级预检（一键，用户无需知道细节）
 *
 * 聚合六项检查，输出三态结论：
 * ✅ 可以升级 / ⚠️ 可升级但建议先收口 / ❌ 需先对齐
 *
 * 检查项：① 版本闭环（引擎 VERSION vs 项目档案 engineVersion）
 * ② 项目档案漂移（init --check）
 * ③ 专家包漂移（expert-sync --check）
 * ④ Skill 软链健康（install-to-workbuddy --check）
 * ⑤ 工作区干净度（git status）
 * ⑥ 在途工单与未闭环决策单（WO / DR）
 *
 * 用法：
 * node <team-repo>/scripts/aimatrix-preflight.mjs --project <项目根> [--fix]
 *
 * --fix：仅把当前引擎版本号补写进项目档案（单字段合并，不重扫项目结构，
 * 不覆盖人工校正内容）。其余任何写操作都不存在。
 *
 * 退出码：0 = 可以升级（含 ⚠️ 档） / 1 = ❌ 有阻断项需先处理
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAM_ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const getArg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ROOT = path.resolve(getArg('--project') || getArg('--root') || process.env.AIM_PROJECT_ROOT || process.cwd());
const FIX = argv.includes('--fix');

const HOME = path.join(ROOT, '.ai-matrix-team');
const CONFIG = path.join(HOME, 'project.json');

/* ---------- 小工具 ---------- */
const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

/** 跑一条子命令，捕获输出与退出码；命令不存在/抛错一律算失败，绝不向上抛 */
function run(file, args, opts = {}) {
  try {
    const out = execFileSync(file, args, { encoding: 'utf8', timeout: 60000, ...opts });
    return { code: 0, out: String(out) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

const engineVersion = (readText(path.join(TEAM_ROOT, 'VERSION')) || '').trim() || 'unknown';

/* ---------- 各项检查 ---------- */
const results = []; // { name, ok: 'pass'|'warn'|'fail', line, hint? }
const blockers = [];
const warns = [];
const add = (name, level, line, hint) => {
  results.push({ name, level, line, hint });
  if (level === 'fail') blockers.push({ name, line, hint });
  if (level === 'warn') warns.push({ name, line, hint });
};

/* ① 版本闭环 */
const profile = readJson(CONFIG);
const archiveVersion = profile?.engineVersion || null;
let vLevel = 'pass';
let vLine = '';
let vHint = null;
if (!profile) {
  vLevel = 'fail';
  vLine = '项目档案不存在（.ai-matrix-team/project.json）';
  vHint = `跑：node ${path.join(TEAM_ROOT, 'scripts', 'aimatrix-init.mjs')} --project ${ROOT}`;
} else if (!archiveVersion) {
  vLevel = FIX ? 'pass' : 'fail';
  vLine = FIX ? `已补记引擎版本 ${engineVersion}（原档案未记录）` : `档案未记录引擎版本（当前引擎 ${engineVersion}）`;
  vHint = FIX ? null : '重跑本命令加 --fix 仅补记版本字段，或重跑 init 对齐';
} else if (archiveVersion !== engineVersion) {
  vLevel = FIX ? 'pass' : 'fail';
  vLine = FIX ? `已补记引擎版本 ${engineVersion}（原记录 ${archiveVersion}）` : `档案由引擎 ${archiveVersion} 生成，当前引擎 ${engineVersion}`;
  vHint = FIX ? null : '重跑本命令加 --fix 仅补记版本字段；若引擎有结构性升级，另跑 init --check 看漂移';
} else {
  vLine = `引擎 ${engineVersion} = 档案记录 ✓`;
}
add('① 版本闭环', vLevel, vLine, vHint);

/* --fix：单字段合并（只动 engineVersion，其余字节不动） */
if (FIX && profile && (profile.engineVersion || '') !== engineVersion) {
  const merged = { ...profile, engineVersion };
  fs.writeFileSync(CONFIG, JSON.stringify(merged, null, 2) + '\n');
}

/* ② 项目档案漂移 */
const initScript = path.join(TEAM_ROOT, 'scripts', 'aimatrix-init.mjs');
const r2 = run(process.execPath, [initScript, '--project', ROOT, '--check']);
add('② 项目档案漂移',
  r2.code === 0 ? 'pass' : 'fail',
  r2.code === 0 ? '与项目现状一致' : (r2.out.trim().split('\n').find((l) => l.includes('⚠️') || l.includes('❌')) || '存在漂移').replace(/^⚠️\s*/, ''),
  r2.code === 0 ? null : `重跑 init 对齐（人工校正过 surfaces/terms 的先 diff）：node ${initScript} --project ${ROOT} --force`);

/* ③ 专家包漂移 */
const syncScript = path.join(TEAM_ROOT, 'scripts', 'expert-sync.mjs');
const r3 = run(process.execPath, [syncScript, '--check'], { cwd: TEAM_ROOT });
add('③ 专家包漂移',
  r3.code === 0 ? 'pass' : 'fail',
  r3.code === 0 ? '全部实例与真源一致' : '实例与真源不一致',
  r3.code === 0 ? null : `跑：node ${syncScript}（validate→register→package→cache→installed 全链）`);

/* ④ Skill 软链 */
const instScript = path.join(TEAM_ROOT, 'scripts', 'install-to-workbuddy.mjs');
const r4 = run(process.execPath, [instScript, '--check', '--project', ROOT]);
add('④ Skill 软链',
  r4.code === 0 ? 'pass' : 'fail',
  r4.code === 0 ? '就绪' : '存在漂移或缺失',
  r4.code === 0 ? null : `跑：node ${instScript} --project ${ROOT}`);

/* ⑤ 工作区干净度 */
let dirty = 0;
try {
  const st = execFileSync('git', ['-C', ROOT, 'status', '--porcelain'], { encoding: 'utf8' });
  dirty = st.split('\n').filter(Boolean).length;
} catch { /* 非 git 仓库视为干净 */ }
add('⑤ 工作区', dirty === 0 ? 'pass' : 'warn',
  dirty === 0 ? '干净（无未提交改动）' : `有 ${dirty} 个未提交改动`,
  dirty === 0 ? null : '升级前建议先提交或收纳，避免升级改动与在途改动混在一起');

/* ⑥ 在途工单与未闭环决策单 */
const woDir = path.join(HOME, 'runtime', 'workorders', 'open');
const drDir = path.join(HOME, 'runtime', 'decisions', 'open');
const listMd = (dir) => {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.endsWith('.journal.md')); } catch { return []; }
};
const fieldOf = (text, field) => {
  const m = text.match(new RegExp(`\\|\\s*${field}\\s*\\|\\s*\\\`?([^|\\\`]+)`));
  return m ? m[1].trim() : '';
};

const openWos = listMd(woDir).map((f) => {
  const t = readText(path.join(woDir, f)) || '';
  return { file: f.replace(/\.md$/, ''), status: fieldOf(t, '状态') || '未知' };
});
const openBlocking = [];
const openDr = listMd(drDir).map((f) => {
  const t = readText(path.join(drDir, f)) || '';
  const status = (fieldOf(t, '状态') || 'OPEN').toUpperCase();
  const blocking = /BLOCKING/.test(t) && !/NON-BLOCKING/.test(t.split('影响')[1] || t);
  return { file: f.replace(/\.md$/, ''), status, blocking: status === 'OPEN' && blocking };
});

const inFlight = openWos.filter((w) => !/DONE/i.test(w.status));
openDr.forEach((d) => { if (d.blocking) openBlocking.push(d); });

add('⑥ 工单 / 决策单',
  openBlocking.length ? 'fail' : inFlight.length || openDr.length ? 'warn' : 'pass',
  openBlocking.length
    ? `有 ${openBlocking.length} 张未闭环 BLOCKING 决策单：${openBlocking.map((d) => d.file).join('、')}`
    : inFlight.length || openDr.length
      ? `在途工单 ${inFlight.length}（${inFlight.map((w) => `${w.file}@${w.status}`).join('、') || '无'}）· 未闭环决策单 ${openDr.length}`
      : '无在途工单、无未闭环决策单',
  openBlocking.length ? '先请创始人答复决策单，闭环后再升级' : inFlight.length ? '建议先收口在途工单再升级（升级会改治理脚本，混跑易出幺蛾子）' : null);

/* ---------- 汇报 ---------- */
const icon = { pass: '✅', warn: '⚠️ ', fail: '❌' };
console.log('== 升级预检 ==');
for (const r of results) {
  console.log(`${icon[r.level]} ${r.name}：${r.line}`);
  if (r.hint) console.log(`   ↳ ${r.hint}`);
}
console.log('');
if (blockers.length) {
  console.log(`结论：❌ 需先对齐（${blockers.length} 项阻断）—— 处理完上面带 ↳ 的项，再重跑本命令。`);
  process.exit(1);
}
if (warns.length) {
  console.log(`结论：⚠️ 可以升级，建议先收口（${warns.length} 项提醒，见 ↳）。`);
  process.exit(0);
}
console.log('结论：✅ 可以升级，一切就绪。');
process.exit(0);
