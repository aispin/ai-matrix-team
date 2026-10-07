#!/usr/bin/env node
/**
 * aimatrix-inspect — 合规巡检 CLI（W8，石头用；零第三方依赖）。
 * 子命令：docs | entitle | matrix-config | migrations | stack | services-leak | open-items | links | all
 * 退出码：0 全过 · 1 有 FAIL（P0 见各项说明）· 2 有 WARN
 * 报告落盘建议：.ai-matrix-team/runtime/reviews/YYYY-MM-合规巡检.md（人工补叙述后归档）
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
const G = (s) => `\x1b[32m${s}\x1b[0m`, Y = (s) => `\x1b[33m${s}\x1b[0m`, R = (s) => `\x1b[31m${s}\x1b[0m`;

const results = []; // {item, status: PASS|WARN|FAIL, detail}

function record(item, status, detail) {
  results.push({ item, status, detail });
  const tag = status === 'PASS' ? G('PASS') : status === 'WARN' ? Y('WARN') : R('FAIL');
  console.log(`${tag}  ${item}\n      └─ ${detail}`);
}

function listApps() {
  const dir = path.join(REPO_ROOT, 'apps');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()) : [];
}

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  if (!fs.statSync(dir).isDirectory()) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      walk(p, exts, out);
    } else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

// ---- 1. docs：三件套 ----
function chkDocs() {
  const apps = listApps();
  const missing = [];
  for (const app of apps) {
    const docs = path.join(REPO_ROOT, 'apps', app, 'docs');
    const names = fs.existsSync(docs) ? fs.readdirSync(docs) : [];
    const has = (re) => names.some((n) => re.test(n));
    if (!has(/BRD/i)) missing.push(`${app}: BRD`);
    if (!has(/PRD/i)) missing.push(`${app}: PRD`);
    if (!has(/TDD/i)) missing.push(`${app}: TDD`);
  }
  record('1.三件套（BRD/PRD/TDD）', missing.length ? 'FAIL' : 'PASS',
    missing.length ? `缺件：${missing.join(' · ')}` : `${apps.length} 个 App 全齐`);
}

// ---- 3. entitle：红线 ----
function chkEntitle() {
  const hits = [];
  for (const app of listApps()) {
    const files = walk(path.join(REPO_ROOT, 'apps', app), ['.ts', '.tsx', '.js', '.jsx', '.vue']);
    for (const f of files) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((l, i) => {
        if (/Entitlement\s*[\n.?\s]*\.?\s*features/.test(l) && !/effectivePlan/i.test(l)) {
          hits.push(`${path.relative(REPO_ROOT, f)}:${i + 1}`);
        }
      });
    }
  }
  record('3.未消费 Entitlement.features（红线 P0）', hits.length ? 'FAIL' : 'PASS',
    hits.length ? `命中：${hits.join(' · ')}` : '未发现');
}

// ---- 4. matrix-config ----
function chkMatrixConfig() {
  const REQUIRED = ['app_id', 'name', 'framework', 'domains', 'devOrigins', 'capabilities'];
  const bad = [], warn = [];
  for (const app of listApps()) {
    const f = path.join(REPO_ROOT, 'apps', app, 'matrix.config.json');
    if (!fs.existsSync(f)) continue; // 允许缺失（由接入流程管）
    try {
      const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
      const missingReq = REQUIRED.filter((k) => cfg[k] === undefined || cfg[k] === '' || (Array.isArray(cfg[k]) && cfg[k].length === 0));
      if (missingReq.length) bad.push(`${app}: 缺必填 ${missingReq.join('/')}`);
      if (cfg.app_id && cfg.app_id !== app) bad.push(`${app}: app_id=${cfg.app_id} 与目录名不一致`);
      if (!Array.isArray(cfg.variants) || cfg.variants.length === 0) warn.push(`${app}: variants[] 缺失/为空（schema 可选）`);
    } catch (e) {
      bad.push(`${app}: JSON 解析失败（${e.message}）`);
    }
  }
  record('4.matrix.config.json schema/variants', bad.length ? 'FAIL' : warn.length ? 'WARN' : 'PASS',
    [bad.length ? bad.join(' · ') : '必填字段齐全且 app_id 一致', warn.length ? `WARN：${warn.join(' · ')}` : ''].filter(Boolean).join(' ｜ '));
}

// ---- 6. migrations：幂等启发式 ----
function chkMigrations() {
  const dir = path.join(REPO_ROOT, 'infra', 'cloudbase', 'migrations');
  const bad = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      const policyGuarded = /DROP\s+POLICY\s+IF\s+EXISTS|DO\s*\$\$/i.test(sql); // 文件级守卫：先 drop if exists 再 create
      for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
        if (/^\s*(--|\/\*)/.test(stmt)) continue;
        if (/ROW\s+LEVEL\s+SECURITY/i.test(stmt)) continue; // ENABLE/DISABLE/FORCE 天然幂等
        const isDDL = /^\s*(CREATE|DROP|ALTER|ADD CONSTRAINT)/i.test(stmt);
        const idempotent = /(IF\s+(NOT\s+)?EXISTS|ON\s+CONFLICT|CREATE\s+OR\s+REPLACE)/i.test(stmt);
        const isCreatePolicy = /^\s*CREATE\s+POLICY/i.test(stmt);
        const isAlterAdd = /^\s*ALTER\s+TABLE.*\bADD\b/i.test(stmt);
        if (isDDL && !idempotent && !isAlterAdd && !(isCreatePolicy && policyGuarded)) {
          bad.push(`${f}: 非幂等 → ${stmt.replace(/\s+/g, ' ').slice(0, 60)}…`);
        }
      }
    }
  }
  record('6.迁移 SQL 幂等', bad.length ? 'WARN' : 'PASS', bad.length ? bad.join(' · ') : (fs.existsSync(dir) ? '全部幂等' : '无迁移目录'));
}

// ---- 7. stack：统一栈 ----
function chkStack() {
  const forbidden = { vue: /^vue$|^vue/, nuxt: /^nuxt/, next: /^next$/, svelte: /^svelte/, angular: /^@angular\//, jquery: /^jquery$/ };
  const bad = [];
  const pkgDirs = [path.join(REPO_ROOT, 'apps'), path.join(REPO_ROOT, 'packages')];
  for (const base of pkgDirs) {
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base)) {
      const pj = path.join(base, d, 'package.json');
      if (!fs.existsSync(pj)) continue;
      let deps = {};
      try {
        const j = JSON.parse(fs.readFileSync(pj, 'utf8'));
        deps = { ...(j.dependencies || {}), ...(j.devDependencies || {}) };
      } catch { continue; }
      for (const [name, re] of Object.entries(forbidden)) {
        for (const dep of Object.keys(deps)) {
          if (re.test(dep)) bad.push(`${path.relative(REPO_ROOT, pj)}: ${dep}（${name} 越界）`);
        }
      }
    }
  }
  record('7.统一栈无越界', bad.length ? 'FAIL' : 'PASS', bad.length ? bad.join(' · ') : '未发现 Vue/Next/Svelte/Angular/jQuery');
}

// ---- 8. services-leak ----
function chkServicesLeak() {
  const appNames = listApps().filter((a) => a !== 'template');
  if (!appNames.length) { record('8.公共服务无 App 业务词', 'PASS', '无 App 可对照'); return; }
  const hits = [];
  const svcDir = path.join(REPO_ROOT, 'services');
  if (fs.existsSync(svcDir)) {
    for (const svc of fs.readdirSync(svcDir)) {
      if (appNames.includes(svc)) continue; // services/<x> 自身含自己的名字（如 services/boss）不算泄漏
      const files = walk(path.join(svcDir, svc), ['.ts', '.js']);
      for (const f of files) {
        const text = fs.readFileSync(f, 'utf8');
        for (const app of appNames) {
          const re = new RegExp(`\\b${app}\\b`, 'i');
          if (re.test(text)) hits.push(`${path.relative(REPO_ROOT, f)}: 含 "${app}"`);
        }
      }
    }
  }
  record('8.公共服务内无 App 业务词', hits.length ? 'FAIL' : 'PASS', hits.length ? hits.slice(0, 8).join(' · ') + (hits.length > 8 ? ` …共 ${hits.length}` : '') : '未发现泄漏');
}

// ---- 9. 前端秘密 ----
function chkSecrets() {
  const suspicious = /(sk-[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|secret\s*[:=]\s*['"][^'"]{8,})/i;
  const hits = [];
  for (const app of listApps()) {
    for (const f of walk(path.join(REPO_ROOT, 'apps', app, 'src'), ['.ts', '.tsx', '.js', '.jsx', '.html'])) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((l, i) => {
        if (/(VITE_|import\.meta\.env)/.test(l) && suspicious.test(l)) hits.push(`${path.relative(REPO_ROOT, f)}:${i + 1}`);
      });
    }
  }
  record('9.前端无秘密入环境变量', hits.length ? 'FAIL' : 'PASS', hits.length ? hits.join(' · ') : '未发现');
}

// ---- 11. open-items 一致性 ----
function chkOpenItems() {
  const ledger = path.join(REPO_ROOT, '.ai-matrix-team', 'runtime', 'decisions', 'LEDGER.md');
  if (!fs.existsSync(ledger)) { record('11.OPEN-ITEMS 与 DR 台账一致', 'WARN', 'LEDGER 不存在'); return; }
  const bad = [];
  for (const app of listApps()) {
    const oi = path.join(REPO_ROOT, 'apps', app, 'docs', 'OPEN-ITEMS.md');
    if (!fs.existsSync(oi)) continue;
    const text = fs.readFileSync(oi, 'utf8');
    // A/B/C 段的非空条目必须带 DR id
    const lines = text.split('\n');
    let sec = '';
    lines.forEach((l, i) => {
      const m = l.match(/^##\s+([A-F])\./);
      if (m) sec = m[1];
      if (/^[-*]\s/.test(l) && ['A', 'B', 'C'].includes(sec) && !/DR-\d{8}-\d{3}/.test(l) && !/（暂无）/.test(l)) {
        bad.push(`${app}/docs/OPEN-ITEMS.md:${i + 1}（${sec} 段条目无 DR id）`);
      }
    });
  }
  record('11.OPEN-ITEMS 每条带 DR id', bad.length ? 'WARN' : 'PASS', bad.length ? bad.join(' · ') : '一致');
}

// ---- 12. 巡检时效 ----
function chkSweepFreshness() {
  const dir = path.join(REPO_ROOT, '.ai-matrix-team', 'runtime', 'reviews');
  let last = null;
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(\d{4}-\d{2})-合规巡检\.md$/);
      if (m) last = m[1];
    }
  }
  if (!last) { record('12.距上次合规巡检', 'WARN', '尚无巡检报告（首次巡检后记录 YYYY-MM）'); return; }
  const months = (new Date().getFullYear() - Number(last.slice(0, 4))) * 12 + (new Date().getMonth() + 1 - Number(last.slice(5, 7)));
  record('12.距上次合规巡检', months > 1 ? 'WARN' : 'PASS', `最近：${last}（${months} 个月前）`);
}

// ---- 13. Skill 链路 ----
function chkLinks() {
  try {
    execFileSync('node', [path.join(__dirname, 'install-to-workbuddy.mjs'), '--check', '--project', REPO_ROOT], { cwd: REPO_ROOT, stdio: 'pipe' });
    record('13.Skill 软链激活链路', 'PASS', 'install-to-workbuddy --check 全绿');
  } catch (e) {
    record('13.Skill 软链激活链路', 'FAIL', '软链漂移 → 重跑 install-to-workbuddy.mjs');
  }
}

// ---- 执行 ----
const cmd = process.argv[2] || 'all';
const map = {
  docs: chkDocs, entitle: chkEntitle, 'matrix-config': chkMatrixConfig, migrations: chkMigrations,
  stack: chkStack, 'services-leak': chkServicesLeak, 'open-items': chkOpenItems,
  secrets: chkSecrets, links: chkLinks,
  sweep: () => { chkSweepFreshness(); },
};
if (cmd === 'all') {
  chkDocs(); chkEntitle(); chkMatrixConfig(); chkMigrations(); chkStack(); chkServicesLeak(); chkSecrets(); chkOpenItems(); chkSweepFreshness(); chkLinks();
} else if (map[cmd]) {
  map[cmd]();
} else {
  console.error('未知子命令。可用：docs|entitle|matrix-config|migrations|stack|services-leak|open-items|secrets|links|sweep|all');
  process.exit(1);
}

const fail = results.filter((r) => r.status === 'FAIL').length;
const warn = results.filter((r) => r.status === 'WARN').length;
console.log(`\n== 巡检小结：PASS ${results.length - fail - warn} · WARN ${warn} · FAIL ${fail} ==`);
console.log('报告落盘：.ai-matrix-team/runtime/reviews/YYYY-MM-合规巡检.md（人工补叙述后归档）');
process.exit(fail ? 1 : warn ? 2 : 0);
