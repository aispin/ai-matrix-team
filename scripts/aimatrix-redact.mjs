#!/usr/bin/env node
/**
 * aimatrix-redact.mjs — 薄层台账脱敏（lib + CLI）
 *
 * 定位：`.ai-matrix-team/` 审计台账（WO/DR/交接单/汇报/复检）要随 git 进库；
 * 当目标项目是 public 仓库（或台账会被分享）时，台账里不得出现：
 * ① 本机绝对路径（/Users/*、/Volumes/*） ② API 密钥/令牌
 * ③ 真实邮箱（github noreply 除外） ④ 内网地址
 *
 * 两条使用路径：
 * A. **写入点强制**（机器 choke point）：report / new-dr / guard journal 等脚本
 * 落盘前调用本文件的 redact —— import { redact } from './aimatrix-redact.mjs'
 * B. **扫描兜底**（覆盖 agent 手写的 reviews / WO 正文）：
 * node aimatrix-redact.mjs --project <root> --scan # 只报不修，退出码 1 = 有泄漏
 * node aimatrix-redact.mjs --project <root> --scan --fix # 自动修复可安全修复的类别
 *
 * 修复安全性分级：
 * fix 安全（--fix 自动改）：绝对路径、键值型密钥、知名令牌前缀、邮箱
 * fix 不安全（只报不改）：内网 IP（误伤示例文档的风险高，交人判断）
 *
 * 退出码：0 干净 / 1 发现泄漏 / 2 参数错误
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REDACTED = '⟦REDACTED⟧';

/* ---------- 泄漏类别定义（single source of truth） ---------- */
const RULES = [
  {
    id: 'abs-path',
    label: '本机绝对路径',
    safeToFix: true,
    // /Users/<name>/... 与 /Volumes/<vol>/...（到第二段为止算「本机指纹」，后续路径保留替换为 ~/）
    re: /\/(?:Users|Volumes)\/[A-Za-z0-9._-]+(?:\/[^\s"'`，。；）】\]|<>]*)?/g,
    fix: (m, ctx) => {
      if (ctx.root && (m === ctx.root || m.startsWith(ctx.root + '/'))) {
        return '.' + m.slice(ctx.root.length) || '.';
      }
      const segs = m.split('/');
      return '~/' + segs.slice(3).join('/'); // /Users/name/x/y → ~/x/y
    },
  },
  {
    id: 'secret-kv',
    label: '键值型密钥（key: value 赋值）',
    safeToFix: true,
    re: /\b((?:api[_-]?key|secret|token|passwd|password|access[_-]?key|private[_-]?key|authorization|bearer)\s*["']?\s*[:=]\s*["']?)([^\s"'，。；）】\]|]{8,})/gi,
    fix: (m) => m.replace(/^(.+["']?[:=]\s*["']?).+$/s, `$1${REDACTED}`),
    skip: (m) => m.includes(REDACTED) || m.includes('⟦'), // 已脱敏的值不再是泄漏
  },
  {
    id: 'token-prefix',
    label: '知名令牌前缀',
    safeToFix: true,
    re: /\b(?:sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g,
    fix: () => REDACTED,
  },
  {
    id: 'email',
    label: '真实邮箱',
    safeToFix: true,
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g,
    fix: (m) => (/@(users\.noreply\.github\.com)$/i.test(m) ? m : REDACTED + '(email)'),
    // 豁免：GitHub 隐私邮箱、npm「包名@版本号」（版本以数字开头，台账里海量出现，误伤代价高）
    skip: (m) => /@(users\.noreply\.github\.com)$/i.test(m) || /^[A-Za-z][A-Za-z0-9._-]*@\d/.test(m),
  },
  {
    id: 'intranet',
    label: '内网地址 / 私有网段 IP',
    safeToFix: false, // 示例文档里可能是刻意写的示例值，交人判断
    re: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g,
    fix: () => REDACTED + '(intranet)',
  },
];

/* ---------- 核心 API（供其他脚本 import） ---------- */

/** 扫描一段文本，返回泄漏清单 [{rule, match, index}] */
export function findLeaks(text, ctx = {}) {
  const leaks = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      // 根路径替换语境下，项目自身路径不算泄漏
      if (rule.id === 'abs-path' && ctx.root && (m[0] === ctx.root || m[0].startsWith(ctx.root + '/'))) continue;
      if (rule.skip && rule.skip(m[0])) continue;
      leaks.push({ rule: rule.id, label: rule.label, match: m[0].slice(0, 120), index: m.index });
      if (m.index === rule.re.lastIndex) rule.re.lastIndex++;
    }
  }
  return leaks;
}

/** 脱敏一段文本：safeToFix 的类别直接替换，其余原样保留 */
export function redact(text, ctx = {}) {
  let out = String(text);
  for (const rule of RULES) {
    if (!rule.safeToFix) continue;
    rule.re.lastIndex = 0;
    out = out.replace(rule.re, (m, ...rest) => {
      if (rule.id === 'abs-path' && ctx.root && (m === ctx.root || m.startsWith(ctx.root + '/'))) return m;
      if (rule.skip && rule.skip(m)) return m;
      return rule.fix(m, ctx);
    });
  }
  return out;
}

/* ---------- CLI：--scan / --fix ---------- */

const argv = process.argv.slice(2);
const getArg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (argv.includes('--scan') || argv.includes('--fix')) {
  const ROOT = path.resolve(getArg('--project') || process.env.AIM_PROJECT_ROOT || process.cwd());
  const LAYER = path.join(ROOT, '.ai-matrix-team');
  const FIX = argv.includes('--fix');
  const JSON_OUT = argv.includes('--json');
  if (!fs.existsSync(LAYER)) {
    console.error(`❌ ${path.relative(ROOT, LAYER)} 不存在 —— 先跑 aimatrix-init.mjs`);
    process.exit(2);
  }

  // 扫描范围：整个薄层（进库的审计资产；runtime/state/ 是易失运行态，不进库不扫）
  const files = [];
  for (const f of fs.readdirSync(LAYER, { recursive: true })) {
    const p = path.join(LAYER, f);
    const relP = path.relative(LAYER, p);
    if (relP.startsWith('runtime/state')) continue;
    try { if (fs.statSync(p).isFile() && /\.(md|json|txt)$/.test(p)) files.push(p); } catch {}
  }

  const ctx = { root: ROOT };
  const report = [];
  let fixedFiles = 0;
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const leaks = findLeaks(raw, ctx);
    if (!leaks.length) continue;
    const rel = path.relative(ROOT, file);
    if (FIX) {
      const next = redact(raw, ctx);
      fs.writeFileSync(file, next);
      const remain = findLeaks(next, ctx).length;
      fixedFiles++;
      report.push({ file: rel, leaks: leaks.length, fixed: leaks.length - remain, remaining: remain });
    } else {
      report.push({ file: rel, leaks: leaks.length, items: leaks.slice(0, 5) });
    }
  }

  if (JSON_OUT) { console.log(JSON.stringify(report, null, 2)); }
  else {
    if (!report.length) {
      console.log('✅ 台账脱敏扫描：0 泄漏（' + files.length + ' 个文件）');
    } else {
      for (const r of report) {
        console.log(`${FIX ? '🔧' : '⚠️'} ${r.file} · ${r.leaks} 处${FIX ? `（已修 ${r.fixed}${r.remaining ? `，剩 ${r.remaining} 处需人工判断` : ''}）` : ''}`);
        if (r.items) for (const it of r.items) console.log(`   [${it.rule}] ${it.match}`);
      }
      console.log(FIX
        ? `\n🔧 已修复 ${fixedFiles} 个文件。标「需人工判断」的（内网 IP）请自行确认。`
        : '\n修复：node aimatrix-redact.mjs --project <root> --scan --fix');
    }
  }
  const dirty = report.some((r) => (FIX ? r.remaining : r.leaks) > 0);
  process.exit(report.length && dirty ? 1 : 0);
}

// 无参数直跑 = 用法说明
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`用法：
  node aimatrix-redact.mjs --project <root> --scan          扫描台账泄漏（退出码 1 = 有）
  node aimatrix-redact.mjs --project <root> --scan --fix    扫描并自动修复安全类别
  node aimatrix-redact.mjs --project <root> --scan --json   机器可读输出

作为 lib：
  import { redact, findLeaks } from './aimatrix-redact.mjs';
  redact(text, { root: PROJECT_ROOT })   // 写盘前脱敏（report / new-dr / journal 已内置）`);
}
