#!/usr/bin/env node
/**
 * aimatrix-guard — ai-matrix 共享面机器门禁（零第三方依赖，Node 22 直跑）
 *
 * 规则源：<project>/.aimt/surfaces.json（缺省回退 <team-repo>/scripts/surfaces-default.json；与 docs/03-shared-surface-control.md §1 同源）
 * 退出码：0 通过 · 1 用法/环境错误 · 2 越权/无单写入 · 3 缺 WO 或缺锁/锁冲突
 * 4 存在未闭环 BLOCKING DR · 5 台账格式不合规 · 6 sync-check 提示（不阻塞）
 *
 * 子命令：
 * surface <paths...> 打印每个路径的面域级别与写入要求
 * check [--wo <id>] (--paths <p...> | --staged) 写入前校验（白名单 / 状态 / 锁）
 * lock <status|acquire|renew|release> --wo <id> [--surfaces s1,s2] [--ttl N]
 * —— 共享锁按**面域分片**：lock.json 持多持有者（schema 2, holders[]），
 * 面域不相交的多个 WO 可同时持锁，仅面域相交者互斥（DR-20261006-012 裁定 A）。
 * dr scan [--wo <id>] [--blocking] 扫描未闭环 DR
 * wo lint <files...> WO / DR / 交接单字段完整性（WO 主文件 >6KB 出警示）
 * wo journal --wo <id> --who <角色#呼号> --what "<text>"
 * 执行日志机器追加：写 <WO文件>.journal.md（append-only，
 * charter §4A.8）；LLM 只发增量条目，禁整读旧文
 * instances 实例呼号检查（撞号 / 未登记，DR-20261005-003）
 * sync-check [--since <sha>] ★ 契约类文档改动是否同步了对应 Skill
 * audit --since <sha> 受控面变更 × WO 覆盖 → 无单写入清单
 * report 当前在办 WO / 锁 / DR 摘要
 * agents 专家包体检：真源→实例 sync --check + 包散件完整性（settings.json 等）
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { redact } from './aimatrix-redact.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAM_ROOT = path.resolve(__dirname, '..'); // 团队仓根（本脚本位于 <team-repo>/scripts/）

// ---------- 项目根解析（两仓解耦：--project / AIM_PROJECT_ROOT / 含 .aimt 的 cwd） ----------
let _PROJECT;
function PROJECT() {
  if (_PROJECT) return _PROJECT;
  const i = process.argv.indexOf('--project');
  const cand = i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1])
    : process.env.AIM_PROJECT_ROOT ? path.resolve(process.env.AIM_PROJECT_ROOT)
    : fs.existsSync(path.join(process.cwd(), '.aimt')) ? process.cwd()
    // 旧布局兼容：含 .ai-matrix-team/ 的项目根也认（启动钩子会自动改名迁移）
    : fs.existsSync(path.join(process.cwd(), '.ai-matrix-team')) ? process.cwd()
    : null;
  if (!cand) die(EXIT.USAGE, '⛔ 未定位到项目根：传 --project <root>、设 AIM_PROJECT_ROOT，或在含 .aimt/ 的项目根运行');
  _PROJECT = cand;
  return cand;
}
const RUNTIME = () => path.join(PROJECT(), '.aimt', 'runtime');
const WO_DIR = () => path.join(RUNTIME(), 'workorders');
const WO_DETAILS = () => path.join(RUNTIME(), 'wo-details'); // v2：详情单唯一落点（白名单/验证/回滚）
const DR_OPEN = () => path.join(RUNTIME(), 'decisions', 'open');
const DR_CLOSED = () => path.join(RUNTIME(), 'decisions', 'closed');
const STATE_DIR = () => path.join(RUNTIME(), 'state');
const LOCK_FILE = () => path.join(STATE_DIR(), 'lock.json');
const LOG_FILE = () => path.join(STATE_DIR(), 'guard.log');
/** 项目薄层 surfaces 覆盖团队默认 */
function surfacesFile() {
  const proj = path.join(PROJECT(), '.aimt', 'surfaces.json');
  return exists(proj) ? proj : path.join(__dirname, 'surfaces-default.json');
}
/** 兼容历史单据/规则里的 .skills/ 前缀 → 项目薄层 .aimt/ */
const normP = (p) => p.startsWith('.skills/') ? '.aimt/' + p.slice(8) : p;

const EXIT = { OK: 0, USAGE: 1, VIOLATION: 2, NOLOCK: 3, DR: 4, FORMAT: 5, SYNC: 6, PROJECT: 7 };

// ---------- 基础工具 ----------
const rel = (p) => path.relative(PROJECT(), p).split(path.sep).join('/');
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8');

function log(msg) {
  try {
    fs.mkdirSync(STATE_DIR(), { recursive: true });
    fs.appendFileSync(LOG_FILE(), `${new Date().toISOString()} ${msg}\n`);
  } catch { /* 日志失败不影响门禁 */ }
}

function die(code, msg) {
  if (msg) console.error(msg);
  process.exit(code);
}

function git(args, { allowFail = false } = {}) {
  try {
    // core.quotePath=false：不要对非 ASCII 路径做八进制转义。否则带中文名的台账文件
    // （如 DR-*-三项决策-*.md）解析不出真实路径 → 掉进 defaultTier(C2) → audit 误报无单写入。
    return execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: PROJECT(), encoding: 'utf8' }).trim();
  } catch (e) {
    if (allowFail) return '';
    die(EXIT.USAGE, `git ${args.join(' ')} 失败：${e.message}`);
  }
}

// ---------- surfaces ----------
let SURFACES = null;
const CONFIG_FILE = () => path.join(PROJECT(), '.aimt', 'project.json');
/** surfaces-default.json 的 wo 块 = 兜底默认（存量项目 surfaces.json 漂移时运行时补齐） */
function defaultWoBlock() {
  try { return JSON.parse(read(path.join(__dirname, 'surfaces-default.json'))).wo || null; } catch { return null; }
}

function surfaces() {
  if (SURFACES) return SURFACES;
  const SURFACES_FILE = surfacesFile();
  if (exists(SURFACES_FILE)) {
    try {
      SURFACES = JSON.parse(read(SURFACES_FILE));
    } catch (e) {
      die(EXIT.USAGE, `surfaces.json 解析失败：${e.message}`);
    }
    // 存量项目副本漂移自愈（内存合并，不改盘）：默认 wo 块新增状态并入，避免老副本缺 TODO/EXECUTING 时 EXECUTING 单 check 恒失败
    if (!SURFACES_FILE.endsWith('surfaces-default.json')) {
      const dw = defaultWoBlock();
      const pw = SURFACES.wo || {};
      if (dw) {
        const missing = (dw.statusesActive || []).filter((s) => !(pw.statusesActive || []).includes(s));
        if (missing.length) console.error(`⚠ surfaces.json wo 块漂移：statusesActive 缺 ${missing.join('/')}——本次运行按默认补齐；跑一次 aimatrix-migrate-v2.mjs 可持久化`);
        SURFACES.wo = {
          ...dw, ...pw,
          statusesActive: [...new Set([...(dw.statusesActive || []), ...(pw.statusesActive || [])])],
          statusesNeedingLock: [...new Set([...(dw.statusesNeedingLock || []), ...(pw.statusesNeedingLock || [])])],
        };
      }
    }
  } else if (exists(CONFIG_FILE())) {
    // 可移植回退：新项目只有 project.json（aimatrix-init 生成；v2.0 前名为 config.json）时，从其 surfaces 段构造规则
    try {
      const cfg = JSON.parse(read(CONFIG_FILE()));
      const reqFor = { S: 'special', C1: 'wo+lock', C2: 'wo+lock', C3: 'wo-cross-app', F: 'free', T: 'template' };
      const noteFor = { S: '特殊面', C1: '共享核心：WO + 守卫核准 + 共享锁', C2: '公共区：WO + 守卫核准 + 共享锁', C3: 'App 私有受控：跨 App 影响须开单', F: '自由面：直接改', T: '台账面：套模板即可写' };
      SURFACES = {
        skip: { tier: 'T', patterns: ['.aimt/runtime/state/**'], note: '运行态机器写' },
        defaultTier: 'C2',
        defaultNote: '未匹配路径从严按 C2 处理',
        rules: Object.entries(cfg.surfaces || {}).flatMap(([tier, globs]) =>
          (globs || []).map((g) => ({ tier, patterns: [g], requirement: reqFor[tier] || 'wo+lock', note: noteFor[tier] || '' })),
        ),
        contractDocs: { rules: [{ patterns: ['docs/shared-contracts.md'] }] },
        wo: defaultWoBlock() || { statusesActive: ['TODO', 'EXECUTING', 'VERIFYING', 'BLOCKED_DR'], statusesNeedingLock: ['VERIFYING'], lockTtlMinutes: 240, lockRenewable: true },
      };
    } catch (e) {
      die(EXIT.USAGE, `project.json 回退构造失败：${e.message}`);
    }
  } else {
    die(EXIT.USAGE, '规则源缺失：无 surfaces.json 且无 project.json —— 先跑 aimatrix-init.mjs 引导生成');
  }
  // 启动自检：面域关键 key 齐全
  const tiers = new Set(['S', 'T', 'C1', 'C2', 'C3', 'F']);
  for (const r of SURFACES.rules) {
    if (!tiers.has(r.tier)) die(EXIT.USAGE, `surfaces.json 自检失败：未知面域 ${r.tier}`);
  }
  if (!SURFACES.contractDocs?.rules?.length) die(EXIT.USAGE, 'surfaces.json 自检失败：contractDocs 为空');
  return SURFACES;
}

/** glob → 锚定正则（支持 **、 *、 ?） */
function globToRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; }
        else if (i + 2 >= glob.length) { if (re.endsWith('/')) re = re.slice(0, -1); re += '(?:/.*)?'; i += 1; } // D1：尾随 ** 匹配目录本身及全部后代（回吞其前导 /）
        else { re += '.*'; i += 1; }
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

function tierOf(relPath) {
  const s = surfaces();
  const skip = s.skip.patterns.some((g) => globToRe(normP(g)).test(normP(relPath)));
  if (skip) return { tier: s.skip.tier, note: s.skip.note };
  for (const r of s.rules) {
    if (r.patterns.some((g) => globToRe(normP(g)).test(normP(relPath)))) {
      return { tier: r.tier, note: r.note };
    }
  }
  return { tier: s.defaultTier, note: s.defaultNote };
}

const CONTROLLED = new Set(['C1', 'C2']);

// ---------- WO / DR 解析 ----------
function findWoFile(id) {
  // v2：详情单落 runtime/wo-details/（SPEC-20261010-03）；旧布局 workorders/{.,open,closed} 仅作迁移前兼容
  for (const dir of [WO_DETAILS(), ...['.', 'open', 'closed'].map((d) => path.join(WO_DIR(), d))]) {
    if (!exists(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      // 排除 .journal.md——否则同前缀的日志文件会被当成 WO 主文件，
      // 解析出的「状态」为空，导致 check / lock acquire 等 --wo 命令全部误报「状态未知」。
      if (f.startsWith(id) && f.endsWith('.md') && !f.endsWith('.journal.md')) return path.join(dir, f);
    }
  }
  return null;
}

/** 从表格行提取单元格 */
function cells(line) {
  return line.split('|').map((c) => c.trim()).filter((c) => c !== '' && !/^-+$/.test(c));
}

/** v2 表行（只读、不建文件）：workorders.md 不存在或未成表 = 迁移前的项目 */
function woTableRows() {
  const f = WO_TABLE();
  if (!exists(f)) return [];
  const lines = read(f).split('\n');
  const head = lines.findIndex((l) => l.startsWith('| 单号'));
  if (head < 0) return [];
  const rows = [];
  for (let i = head + 2; i < lines.length; i++) {
    if (!lines[i].startsWith('|')) break;
    rows.push({ line: lines[i], c: cells(lines[i]) });
  }
  return rows;
}

function parseWo(id) {
  const row = woTableRows().find((r) => r.c[0] === id) || null;
  const file = findWoFile(id);
  if (!row && !file) return null;
  const text = file ? read(file) : '';
  const statusM = text.match(/\|\s*\*{0,2}状态\*{0,2}\s*\|\s*`?([A-Z_]+)`?/);
  const execM = text.match(/\|\s*\*{0,2}执行(角色)?\*{0,2}\s*\|\s*([^|\n]+)\|/);
  const wlSection = text.split(/^##\s*2\..*$/m)[1]?.split(/^##\s/m)[0] || '';
  const globs = new Set();
  for (const line of wlSection.split('\n')) {
    if (!line.includes('|')) continue;
    for (const c of cells(line)) {
      const cleaned = c.replace(/`/g, '');
      // 像 glob/路径的 token：含 / 或 *，或根级文件（含 . 扩展名形态）；不含空格与中文
      if ((cleaned.includes('/') || cleaned.includes('*') || cleaned.includes('.')) && !/\s/.test(cleaned) && !/[\u4e00-\u9fff]/.test(cleaned)) {
        globs.add(cleaned);
      }
    }
  }
  // D6：DR 关联只认**表格行**（§7 关联 DR 表等 | 开头行）；叙述/注释里的全号一律不算，防双向误绑
  const drLines = [];
  for (const line of text.split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    for (const m of line.match(/DR-\d{8}-\d{3}/g) || []) drLines.push(m);
  }
  const fileDrs = [...new Set(drLines)];
  // v2：表行是唯一真相源（状态/处理者/关联）；详情单只供白名单三字段。无表行时回落详情单（迁移前兼容）。
  const rowDrs = row ? [...new Set((row.c[3] || '').match(/DR-\d{8}-\d{3}/g) || [])] : [];
  const inDetails = file ? file.startsWith(WO_DETAILS() + path.sep) : false;
  return {
    id,
    file,
    relFile: file ? rel(file) : null,
    // 归档判定：表行在 = 未归档；旧布局只看 closed/ 目录。详情单无表行 ≠ 已归档（可能是孤儿，check 另行提示认领）
    closed: row ? false : (file && !inDetails ? file.includes(`${path.sep}closed${path.sep}`) : false),
    hasRow: !!row,
    inDetails,
    status: row ? (row.c[4] || null) : (statusM ? statusM[1] : null),
    executor: row ? (row.c[5] && row.c[5] !== '—' ? row.c[5] : null) : (execM ? execM[2].replace(/`/g, '').trim() : null),
    globs: [...globs],
    drs: rowDrs.length ? rowDrs : fileDrs,
  };
}

function woCovers(wo, relPath) {
  return wo.globs.some((g) => globToRe(normP(g)).test(normP(relPath)));
}

function parseDr(file) {
  const text = read(file);
  const field = (name) => {
    const m = text.match(new RegExp(`\\|\\s*\\*{0,2}${name}\\*{0,2}\\s*\\|\\s*([^|]*?)\\s*\\|`));
    return m ? m[1].replace(/`/g, '').trim() : '';
  };
  const idM = path.basename(file).match(/DR-\d{8}-\d{3}/);
  return {
    id: idM ? idM[0] : path.basename(file, '.md'),
    file,
    relFile: rel(file),
    blocking: /BLOCKING/i.test(field('阻塞级别')) && !/NON/i.test(field('阻塞级别')),
    status: field('状态') || 'OPEN',
    owner: field('所属'),
    type: field('决策类型'),
    title: (text.match(/^#\s+(.+)$/m) || [, ''])[1],
  };
}

function scanDrs({ wo, blockingOnly } = {}) {
  const out = [];
  for (const dir of [DR_OPEN(), DR_CLOSED()]) {
    if (!exists(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/^DR-\d{8}-\d{3}.*\.md$/.test(f)) continue;
      const d = parseDr(path.join(dir, f));
      if (dir === DR_CLOSED()) d.status = d.status === 'OPEN' ? 'ANSWERED' : d.status; // closed 目录一律视为已闭环
      if (d.status !== 'OPEN') continue;
      if (blockingOnly && !d.blocking) continue;
      if (wo && !(d.owner.includes(wo) || (woDRs(wo) || []).includes(d.id))) continue;
      out.push(d);
    }
  }
  return out;
}

const woDRsCache = new Map();
function woDRs(woId) {
  if (woDRsCache.has(woId)) return woDRsCache.get(woId);
  const wo = parseWo(woId);
  const v = wo ? wo.drs : [];
  woDRsCache.set(woId, v);
  return v;
}

// ---------- 锁（面域分片多持有者 · schema 2）----------
// lock.json 结构（schema 2）：
// { schema:2, holders:[{wo,surfaces,acquiredAt,ttlMinutes,renewable}],
// holder, surfaces, acquiredAt, ttlMinutes, renewable }
// 顶层 holder/surfaces/... 是**主 holder（holders[0]）的 legacy 镜像**：
// §6 回滚硬前提（无它则回滚旧 guard 会把已持锁误判为空闲）+ 白名单外历史消费者（aimatrix-report /
// dashboard/server）保底。写侧恒保留镜像；读侧兼容 holders[] 与 legacy 单 holder 两种残留。

/** 归一化读取：任何残留结构 → { holders: [...] }（逐项补 wo，兼容 h.holder 别名） */
function readLockDoc() {
  if (!exists(LOCK_FILE())) return { holders: [] };
  let raw;
  try {
    raw = JSON.parse(read(LOCK_FILE()));
  } catch {
    return { holders: [] };
  }
  if (!raw || typeof raw !== 'object') return { holders: [] };
  if (Array.isArray(raw.holders)) {
    const holders = raw.holders
      .filter((h) => h && typeof h === 'object')
      .map((h) => ({ ...h, wo: h.wo || h.holder }))
      .filter((h) => h.wo);
    return { holders };
  }
  if (raw.holder) {
    return {
      holders: [{
        wo: raw.holder,
        surfaces: raw.surfaces || [],
        acquiredAt: raw.acquiredAt,
        ttlMinutes: raw.ttlMinutes,
        renewable: raw.renewable,
      }],
    };
  }
  return { holders: [] };
}

/** 持久化：过滤空项；空 → 删文件（保持原语义）；否则写 schema 2 + 镜像主 holder */
function writeLockDoc(doc, why) {
  const holders = (doc?.holders || []).filter((h) => h && h.wo);
  fs.mkdirSync(STATE_DIR(), { recursive: true });
  if (!holders.length) {
    fs.rmSync(LOCK_FILE(), { force: true });
    log(why);
    return;
  }
  const [primary] = holders;
  const out = {
    schema: 2,
    holders,
    // legacy 镜像 = 主 holder（holders[0]）；回滚硬前提 + 白名单外消费者保底
    holder: primary.wo,
    surfaces: primary.surfaces || [],
    acquiredAt: primary.acquiredAt,
    ttlMinutes: primary.ttlMinutes ?? surfaces().wo.lockTtlMinutes,
    renewable: primary.renewable ?? true,
  };
  fs.writeFileSync(LOCK_FILE(), JSON.stringify(out, null, 2) + '\n');
  log(why);
}

/** 存活 holder 数组；逐项按自身 ttlMinutes 判过期，有剔除则写回并记日志 */
function liveLocks() {
  const doc = readLockDoc();
  const now = Date.now();
  const defaultTtl = surfaces().wo.lockTtlMinutes;
  const survivors = [];
  const expired = [];
  for (const h of doc.holders) {
    const acquired = Date.parse(h.acquiredAt);
    const ttl = (h.ttlMinutes || defaultTtl) * 60_000;
    if (!Number.isFinite(acquired) || now - acquired > ttl) { expired.push(h.wo); continue; }
    survivors.push(h);
  }
  if (expired.length) {
    writeLockDoc({ holders: survivors }, `lock expired/invalid — TTL 自动释放：${expired.join(', ')}`);
  }
  return survivors;
}

/** 单 holder 剩余分钟数 */
function holderLeftMin(h) {
  const ttl = (h.ttlMinutes || surfaces().wo.lockTtlMinutes) * 60_000;
  return Math.round((Date.parse(h.acquiredAt) + ttl - Date.now()) / 60_000);
}

// —— 面域推导（H1：冲突面只取白名单在 C1/C2 的子集，排除 T/F/S 路径）——
/** 逐条判面域，只保留 C1/C2（受控面）并去重；T/F/S 路径不计入冲突面
 * （否则 WO-14/WO-15 白名单均含 `.skills/runtime/**`(T) → 恒相交，分片裁定落空）。 */
function controlledGlobs(globs) {
  const out = new Set();
  for (const g of globs || []) {
    if (typeof g !== 'string' || !g) continue;
    if (CONTROLLED.has(tierOf(g).tier)) out.add(g);
  }
  return [...out];
}

/** holder 的冲突面 = 锁内自声明 surfaces ∪ 本 WO 白名单（白名单为唯一真相源，防漏声明），仅留 C1/C2 */
function holderSurfaces(h) {
  const wl = parseWo(h.wo)?.globs || [];
  return controlledGlobs([...(h.surfaces || []), ...wl]);
}

/** 段兼容：任一方 `**`→真；任一方 `*`→真；双字面量→相等；其余（含更复杂通配符）→从宽取真 */
function segCompatible(x, y) {
  if (x === '**' || y === '**') return true;
  if (x === '*' || y === '*') return true;
  const hasWild = (s) => /[*?]/.test(s);
  if (!hasWild(x) && !hasWild(y)) return x === y;
  // 双方（或一方）含更复杂通配符：保守取舍——宁可判相交（偏互斥），不误判相交给并发双持开口子
  return true;
}

/** 两条 glob 是否可能命中同一路径：按 `/` 切段做段级 NFA 可达性（`**`=零或多段），BFS 到 (la,lb) 即相交 */
function globsOverlap(a, b) {
  const sa = String(a).split('/');
  const sb = String(b).split('/');
  const la = sa.length;
  const lb = sb.length;
  const seen = new Set();
  const queue = [[0, 0]];
  while (queue.length) {
    const [i, j] = queue.pop();
    const key = `${i},${j}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (i === la && j === lb) return true;
    const push = (x, y) => { if (x <= la && y <= lb) queue.push([x, y]); };
    if (i < la && sa[i] === '**') {
      push(i + 1, j);              // ** 匹配零段（epsilon）
      if (j < lb) push(i, j + 1);  // ** 消费一段后停留
    }
    if (j < lb && sb[j] === '**') {
      push(i, j + 1);
      if (i < la) push(i + 1, j);
    }
    if (i < la && j < lb && sa[i] !== '**' && sb[j] !== '**') {
      if (segCompatible(sa[i], sb[j])) push(i + 1, j + 1);
    }
  }
  return false;
}

/** D7：WO 号归一化比对——锁内存的是全号，--wo 传短号（前缀）时也算同单 */
function sameWo(holderWo, woId) {
  if (!holderWo || !woId) return false;
  return holderWo === woId || holderWo.startsWith(woId + '-') || woId.startsWith(holderWo + '-');
}

// ---------- 实例呼号（DR-20261005-003） ----------
/** 执行字段语法：`角色#呼号`（如 Bruce#1）；无 # 视为纯角色（老单兼容） */
function parseExecutor(e) {
  const m = /^(.+?)#([0-9A-Za-z]+)$/.exec((e || '').trim());
  return m ? { role: m[1].trim(), callsign: m[2] } : { role: (e || '').trim(), callsign: null };
}
const INSTANCES_FILE = () => path.join(STATE_DIR(), 'instances.json');
/** D2：instances.json 无 role 字段，从 session 前缀（如 "implementer#1 · xxx"）提取角色合成 role#callsign 键 */
function instKey(session, callsign) {
  const m = /^(.+?)#[0-9A-Za-z]+/.exec((session || '').trim());
  return `${m ? m[1].trim() : '' }#${callsign}`;
}
function readInstances() {
  if (!exists(INSTANCES_FILE())) return [];
  try { return JSON.parse(fs.readFileSync(INSTANCES_FILE(), 'utf8')); } catch { return []; }
}
function activeWos() {
  const out = new Map();
  const key = (id) => (String(id || '').match(/^WO-\d{8}-\d{2}/) || [id])[0];
  // v2：workorders.md 是唯一真相源——除 DONE 外都算在途（含 TODO，尚未开工也要可见）
  for (const r of woTableRows()) {
    if (r.c[4] === 'DONE') continue;
    const wo = parseWo(r.c[0]);
    if (wo) out.set(key(wo.id), wo);
  }
  // 迁移前兼容：旧布局按详情单状态（同一单号已被表覆盖则不重复计入）
  for (const d of ['.', 'open']) {
    const dir = path.join(WO_DIR(), d);
    if (!exists(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/^WO-\d{8}-\d{2}-.*\.md$/.test(f)) continue;
      const wo = parseWo(path.basename(f, '.md'));
      if (!wo || !wo.status || !surfaces().wo.statusesActive.includes(wo.status)) continue;
      if (!out.has(key(wo.id))) out.set(key(wo.id), wo);
    }
  }
  return [...out.values()];
}
/** 两条规则：① 同角色同呼号挂在多张在办单 → 撞号；② 执行字段带了呼号但 instances.json 未登记 */
function checkInstances() {
  const warns = [];
  const actives = activeWos().filter((w) => w.executor);
  const byKey = new Map();
  for (const w of actives) {
    const { role, callsign } = parseExecutor(w.executor);
    if (!callsign) continue;
    const key = `${role}#${callsign}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(w.id);
  }
  for (const [key, ids] of byKey) {
    if (ids.length > 1) warns.push(`撞号：${key} 同时挂在 ${ids.join(' 与 ')}（同角色并行实例呼号必须唯一）`);
  }
  const registered = new Set(readInstances().map((i) => instKey(i.session, i.callsign)));
  for (const w of actives) {
    const { role, callsign } = parseExecutor(w.executor);
    if (callsign && !registered.has(`${role}#${callsign}`)) {
      warns.push(`未登记：${w.id} 的呼号 ${w.executor} 不在 ${rel(INSTANCES_FILE())}（spawn 后请由PC登记）`);
    }
  }
  return warns;
}
/** §4A.8：执行日志机器追加（append-only journal）——过程叙事出主文件，主文件 ≤6KB */
function cmdWoJournal(args) {
  const woId = args.get('--wo');
  const who = args.get('--who');
  const what = args.get('--what');
  if (!woId || !who || !what) die(EXIT.USAGE, '用法：wo journal --wo <id> --who <角色#呼号> --what "<动作与结果>"');
  const dirs = [WO_DETAILS(), path.join(WO_DIR(), 'open'), path.join(WO_DIR(), 'closed')];
  let woFile = null;
  for (const d of dirs) {
    const hit = fs.readdirSync(d).filter((f) => /^WO-.*\.md$/.test(f) && !f.endsWith('.journal.md') && f.startsWith(woId));
    if (hit.length) { woFile = path.join(d, hit[0]); break; }
  }
  if (!woFile) die(EXIT.USAGE, '找不到 WO：' + woId + '（wo-details/ 与旧布局 open/closed 均无前缀匹配）');
  const journal = woFile.replace(/\.md$/, '.journal.md');
  if (!exists(journal)) {
    fs.writeFileSync(journal, [
      '# ' + path.basename(woFile).replace(/\.md$/, '') + ' · 执行日志（journal）',
      '',
      '> append-only · 由「guard wo journal」机器维护（charter §4A.8）。读方按需取增量，禁整读旧文。',
      '',
      '| 时间 | 谁 | 动作与结果 |',
      '|---|---|---|',
      '',
    ].join('\n'));
  }
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  // 脱敏：journal 随台账进库，动作描述里不得带密钥/本机路径/邮箱
  const whatSafe = redact(String(what), { root: PROJECT() }).replace(/\|/g, '\\|');
  const row = '| ' + ts + ' | ' + who + ' | ' + whatSafe + ' |\n';
  fs.appendFileSync(journal, row);
  log('journal ' + path.basename(journal) + ' ← ' + who);
  console.log(G('✓ 已追加：') + rel(journal));
  console.log('  ' + row.trim());
  process.exit(EXIT.OK);
}

/** T6：token 注入面基线表——度量先行，防盲优化 */
function cmdStats() {
  const size = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const kb = (n) => (n / 1024).toFixed(1) + 'KB';
  const ls = (d) => { try { return fs.readdirSync(d); } catch { return []; } };
  const count = (d, re) => ls(d).filter((f) => re.test(f)).length;
  const skillDirs = ls(TEAM_ROOT).filter((d) => /^aimatrix-/.test(d));
  const skillSizes = skillDirs.map((d) => size(path.join(TEAM_ROOT, d, 'SKILL.md')));
  const docNames = ls(path.join(TEAM_ROOT, 'docs')).filter((f) => /^0\d-.+\.md$/.test(f));
  const docSizes = docNames.map((f) => size(path.join(TEAM_ROOT, 'docs', f)));
  const idxSizes = ls(path.join(TEAM_ROOT, 'docs', 'index')).map((f) => size(path.join(TEAM_ROOT, 'docs', 'index', f)));
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const rows = [
    ['角色 SKILL.md', skillSizes.length + ' 个 / ' + kb(sum(skillSizes))],
    ['治理文档 01-08', docSizes.length + ' 篇 / ' + kb(sum(docSizes))],
    ['索引卡', idxSizes.length + ' 张 / ' + kb(sum(idxSizes))],
    ['WO 表行（v2）', woTableRows().length + ' 行 · 在途 ' + activeWos().length + ' 单'],
    ['WO 详情单', count(WO_DETAILS(), /^WO-.*\.md$/) + ' 张 · 旧布局 open ' + count(path.join(RUNTIME(), 'workorders', 'open'), /^WO-.*\.md$/) + ' 张'],
    ['DR open', count(path.join(RUNTIME(), 'decisions', 'open'), /^DR-.*\.md$/) + ' 张'],
    ['WO journal', (() => {
      const dirs = [WO_DETAILS(), path.join(RUNTIME(), 'workorders', 'open'), path.join(RUNTIME(), 'workorders', 'closed')];
      const js = dirs.flatMap((d) => ls(d).filter((f) => f.endsWith('.journal.md')).map((f) => path.join(d, f)));
      return js.length + ' 个 / ' + kb(sum(js.map(size)));
    })()],
    ['WO 详情单最大 3 张', (() => {
      const es = ls(WO_DETAILS()).filter((f) => /^WO-.*\.md$/.test(f) && !f.endsWith('.journal.md')).map((f) => ({ f, b: size(path.join(WO_DETAILS(), f)) })).sort((a, b) => b.b - a.b).slice(0, 3);
      return es.map((e) => e.f.slice(0, 20) + '…' + kb(e.b)).join(' · ') || '—';
    })()],
    ['instances 登记', String(readInstances().length) + ' 条'],
    ['锁在持', liveLocks().length + ' 单'],
    ['今日日志', kb(size(path.join(PROJECT(), '.workbuddy/memory', today + '.md')))],
    ['spawn 期望载荷', (() => {
      // 单次 spawn 的模型侧读取面：角色 md + 岗位 SKILL + 索引卡 + 项目档案
      // 上界 = 全读；按需 = 相关索引卡 1 张 + 档案相关字段（charter §4A.5 按需读纪律）
      const members = ls(path.join(TEAM_ROOT, 'members')).filter((f) => f.endsWith('.md'));
      const memSizes = members.map((f) => size(path.join(TEAM_ROOT, 'members', f)));
      const idx = sum(idxSizes);
      const idxOne = idxSizes.length ? Math.round(idx / idxSizes.length) : 0;
      const skillAvg = skillSizes.length ? Math.round(sum(skillSizes) / skillSizes.length) : 0;
      const memAvg = memSizes.length ? Math.round(sum(memSizes) / memSizes.length) : 0;
      const profilePath = path.join(PROJECT(), '.aimt', 'project.json');
      let profileRel = 0;
      try {
        const pj = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        profileRel = Buffer.byteLength(JSON.stringify({ surfaces: pj.surfaces, team: pj.team, docs: pj.docs }));
      } catch {}
      const worst = memAvg + skillAvg + idx + size(profilePath);
      const need = memAvg + skillAvg + idxOne + (profileRel || size(profilePath));
      return `最坏 ${kb(worst)} / 按需 ≈ ${kb(need)}（角色均 ${kb(memAvg)} + SKILL 均 ${kb(skillAvg)} + ${kb(idxOne)}/张索引卡 + 档案相关字段 ${kb(profileRel)}）`;
    })()],
    ['设计稿产物', (() => {
      // 产物面：草稿 JSON（模型写）vs 渲染 HTML（工具写）——出稿默认走 aimatrix-render
      const dirs = [];
      const walk = (d, depth) => {
        if (depth > 5) return;
        let es = [];
        try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of es) {
          if (e.isDirectory() && !/^(node_modules|\.git|dist)$/.test(e.name)) walk(path.join(d, e.name), depth + 1);
          else if (e.isFile() && /\.(draft\.json|-design\.html)$/.test(e.name)) dirs.push(path.join(d, e.name));
        }
      };
      walk(PROJECT(), 0);
      const drafts = dirs.filter((f) => f.endsWith('.draft.json'));
      const htmls = dirs.filter((f) => f.endsWith('-design.html'));
      if (!drafts.length && !htmls.length) return '无（出稿见 aimatrix-render.mjs）';
      const db = drafts.reduce((a, f) => a + size(f), 0);
      const hb = htmls.reduce((a, f) => a + size(f), 0);
      return `草稿 ${kb(db)} / 产物 ${kb(hb)}（${drafts.length} : ${htmls.length}）`;
    })()],
  ];
  console.log(T('== token 注入面基线 =='));
  for (const [k, v] of rows) console.log('  ' + k.padEnd(18) + v);
  console.log(G('  纪律：Read 带 offset/limit；治理文档先读 index/ 索引卡（charter §4A.5）。'));
  process.exit(EXIT.OK);
}
function cmdInstances() {
  const warns = checkInstances();
  const inst = readInstances();
  console.log(T('== 实例登记（runtime/state/instances.json）=='));
  if (!inst.length) console.log('  空（并行多实例时由PC spawn 后登记）');
  for (const i of inst) console.log(`  ${i.callsign}  会话=${i.session || '—'}  WO=${i.wo || '—'}  since=${i.startedAt || '—'}`);
  console.log(T('\n== 呼号检查 =='));
  if (!warns.length) console.log(G('  通过：无撞号、无未登记呼号。'));
  for (const w of warns) console.error(Y(`  ⚠ ${w}`));
  process.exit(EXIT.OK);
}

// ---------- 单据生成（模板渲染交给脚本，模型只写内容结论） ----------

function readDirSafe(d) { try { return fs.readdirSync(d); } catch { return []; } }

// 参数解析器对多值参数返回数组，统一归一化
const one = (v) => (Array.isArray(v) ? v[0] : v) || '';
const many = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** 编号在任何载体（表行/详情单/归档）出现即视为已消费——取号 = 全源 max+1，永不复用 */
function nextWoId() {
  const d = new Date();
  const day = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  let max = 0;
  const bump = (s) => {
    const m = new RegExp(`^WO-${day}-(\\d{2,3})`).exec(String(s || ''));
    if (m) max = Math.max(max, Number(m[1]));
  };
  for (const r of woTableRows()) bump(r.c[0]);
  for (const f of [...readDirSafe(WO_DETAILS()), ...readDirSafe(WO_DIR()), ...readDirSafe(path.join(WO_DIR(), 'open')), ...readDirSafe(path.join(WO_DIR(), 'closed'))]) bump(f);
  for (const id of idsInArchive(new RegExp(`WO-${day}-\\d{2,3}`, 'g'))) bump(id);
  return `WO-${day}-${String(max + 1).padStart(2, '0')}`;
}

const cleanCell = (s, n) => String(s || '').replace(/\|/g, '／').replace(/\s+/g, ' ').trim().slice(0, n) || '—';
/** 创建即挂牌：详情单落盘必须有表行（幂等）。返回是否新补 */
function ensureWoRow(id, title, brief, ref) {
  if (woTableRows().some((r) => r.c[0] === id)) return false;
  const f = WO_TABLE();
  const lines = readOrCreate(f, WO_TABLE_HEADER).replace(/\n*$/, '\n').split('\n');
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  let last = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].startsWith('|')) { last = i; break; }
  const row = `| ${id} | ${cleanCell(title, 24)} | ${cleanCell(brief, 30)} | ${cleanCell(ref, 40)} | TODO | — | — | ${todayStr()} |`;
  if (last < 0) lines.push(row); else lines.splice(last + 1, 0, row);
  fs.writeFileSync(f, lines.join('\n') + '\n');
  return true;
}

/** 孤儿详情单：今日已落盘、但既无表行也未被归档收口（创建即挂牌失败的残留） */
function detailOrphans(day) {
  const rows = new Set(woTableRows().map((r) => r.c[0]));
  let arch = '';
  const archDir = ARCHIVE_DIR();
  for (const f of readDirSafe(archDir)) arch += read(path.join(archDir, f));
  return readDirSafe(WO_DETAILS())
    .map((f) => (new RegExp(`^WO-${day}-(\\d{2,3})`)).exec(f)?.[0])
    .filter((id, i, a) => id && a.indexOf(id) === i && !rows.has(id) && !arch.includes(id))
    .sort();
}

const warnOrphanDetails = (day) => {
  const orphans = detailOrphans(day);
  if (orphans.length) console.error(Y(`⚠ 今日存在未挂牌详情单：${orphans.join('、')}——认领：wo table add --id <单号> --title <任务名> --brief <简述>`));
  return orphans.length;
};

function cmdWoNew(args) {
  const slug = one(args.get('--slug')).trim();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) die(EXIT.USAGE, '用法：wo new --slug <kebab-case> [--id <WO-YYYYMMDD-NN 绑定已有表行>] [--level L0|L1|L2] [--surface C1|C2|C3|F] [--paths "a/**,b/**"] [--purpose "…"]');
  const wanted = one(args.get('--id')).trim();
  if (wanted) requireTableId(wanted, /^WO-\d{8}-\d{2}$/, 'WO');
  const level = one(args.get('--level') || 'L2').toUpperCase();
  const surface = one(args.get('--surface') || 'C2').toUpperCase();
  const paths = many(args.get('--paths')).length ? many(args.get('--paths')).join(',').split(',').map((s) => s.trim()).filter(Boolean) : ['（待填：glob，一行一个）'];
  // 面域逐路推断：具体路径按 surfaces 规则实判；glob 路径做段级相交推断；占位/推断不出 → 保留声明 --surface
  const tierOfPath = (p) => {
    if (!/^[\w./@*-]+$/.test(p)) return surface;
    try {
      if (!/[*?]/.test(p)) return tierOf(p).tier;
      const s = surfaces();
      if (s.skip.patterns.some((g) => globsOverlap(normP(g), p))) return s.skip.tier;
      const hit = s.rules.find((r) => r.patterns.some((g) => globsOverlap(normP(g), p)));
      return hit ? hit.tier : s.defaultTier;
    } catch { return surface; }
  };
  const surfaceRows = () => paths.map((p) => `| ${tierOfPath(p)} | \`${p}\` |`).join('\n');
  const purpose = one(args.get('--purpose')) || '（三行内：改什么 / 为什么现在改 / 依据）';
  const id = wanted || nextWoId();
  const today = new Date().toISOString().slice(0, 10);
  const body = `# ${id} · 任务单

| 字段 | 值 |
|---|---|
| **id** | \`${id}\` |
| 状态 | \`DRAFT\` |
| 申请人 | PC（产研高级总监） |
| 执行角色 | — |
| 验收级别 | \`${level}\`（L0 直提 / L1 质检代验收 / L2 亲验收） |
| 创建 / 完成 | ${today} / — |

## 1. 目的与背景

${purpose}

## 2. 面域与路径白名单

| 面域 | 路径（glob） |
|---|---|
${surfaceRows()}

> 白名单外一律不得改；扩大 → 回团长核准。

## 3. 变更类型

\`additive\` / \`非破坏\` / \`破坏性\` / \`新增契约\`（破坏性 → 事前 INTENT + 兼容证明各一行）

## 4. 影响面

- 受影响 App / 服务 / 在线产物：
- 需重部署（运行时行为 / CORS / 密钥轮换）：

## 5. 验证方式（可机器判定）

\`\`\`bash
# 3-5 条可复制直跑的命令 + 期望结果
\`\`\`

## 6. 回滚方案

（可执行动作，不写「重新部署上一版」）

## 7. 关联 DR

| DR id | 一句话 | 阻塞级别 | 状态 |
|---|---|---|---|
| — | — | — | — |

## 8. 团长（风控）意见

- [ ] 影响面 / 验证方式 / 回滚方案 三齐
- [ ] 面域级别与声明一致
- [ ] 破坏性 → 事前 INTENT 已登记
- [ ] 共享锁已获取

签名：PC · —

## 9. 执行记录

- journal：\`${id}.journal.md\`（0 条）
- spawn 次数：0

## 10. 收口

- [ ] QA 放行
- [ ] \`shared-contracts.md\` §3 已登记（含 WO 号）
- [ ] 交接单已落盘（≤15 行）
- [ ] 共享锁已释放
- [ ] 术语缩写自检（无裸用缩写）
- [ ] 归档：\`guard archive move --kind wo --id <单号>\`（活动表 → \`runtime/archive/YYYY-MM.md\`）
`;
  // 单一真相源：模板存在则以 docs/templates/wo.md 为准（内嵌骨架仅作兜底，防双份漂移）
  const tplFile = path.join(TEAM_ROOT, 'docs/templates/wo.md');
  const tpl = exists(tplFile) ? read(tplFile) : null;
  const finalBody = tpl
    ? tpl
      .replace(/^# WO-YYYYMMDD-NN-<slug> · 任务单$/m, `# ${id} · ${slug}`)
      .replace(/WO-YYYYMMDD-NN-<slug>/g, id)
      .replace('| 验收级别 | `L2` |', `| 验收级别 | \`${level}\` |`)
      .replace('| 创建 / 完成 | YYYY-MM-DD / — |', `| 创建 / 完成 | ${today} / — |`)
      .replace('（≤3 行：改什么 / 为什么现在改 / 依据节号。写不进 = 拆单）', purpose)
      .replace('| C1/C2/C3/F | `（待填）` |', surfaceRows())
      .replace(/WO-xxx\.journal\.md/g, `${id}.journal.md`)
    : body;
  // v2：详情单落 runtime/wo-details/（单号不带 slug）
  const dir = WO_DETAILS();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.md`);
  if (fs.existsSync(file)) die(EXIT.USAGE, `已存在：${file}`);
  fs.writeFileSync(file, finalBody);
  // 创建即挂牌：详情单落盘必须有表行（--id 绑定已有行时幂等跳过）
  const day = todayStr().replace(/-/g, '');
  if (ensureWoRow(id, slug, purpose, '—')) console.log(G(`✚ 已补表行 ${id}（TODO，创建即挂牌）`));
  else console.log(`↷ 表行 ${id} 已在，跳过补行`);
  warnOrphanDetails(day);
  console.log(`✓ 已生成 ${path.relative(PROJECT(), file)}（${Buffer.byteLength(finalBody)} B）`);
  console.log(G('  下一步：填 §1/§2/§5/§6 → guard wo lint <file> → 团长核准 → 派单'));
  process.exit(EXIT.OK);
}

function cmdHandoffNew(args) {
  const wo = one(args.get('--wo')).trim();
  // v2 单号 = WO-YYYYMMDD-NN（slug 只进标题）；旧长号兼容
  if (!/^WO-\d{8}-\d{2,3}(-[a-z0-9-]+)?$/.test(wo)) die(EXIT.USAGE, '用法：handoff --wo WO-YYYYMMDD-NN[-<slug>]');
  const dir = path.join(RUNTIME(), 'handoffs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${wo}-handoff.md`);
  const today = new Date().toISOString().slice(0, 10);
  const body = `# ${wo} · 交接单

| WO | ${wo} | 完成日期 | ${today} | 参与角色 | PC / 毛毛 / Bruce / 石头 / 波波（勾选） |
|---|---|---|---|---|---|

## 1. 一句话结论

（做了什么 / 现在什么状态：可用 · 待验证 · 部分上线 · 已回滚）

## 2. 改动清单

| 面域 | 路径 | 性质 | 备注 |
|---|---|---|---|
| | | additive / 非破坏 / 破坏性 | |

## 3. 验证证据

\`\`\`text
（贴命令尾行，不贴过程）
\`\`\`

## 4. 契约登记

（shared-contracts.md §3：无则写「无契约变更」）

## 5. 回滚方式

（命令 / 开关 / 反向迁移；已演练：是 / 否）

## 6. 遗留 DR / 风险

| # | 事项 | 级别 | 处理时点 |
|---|---|---|---|
| | | BLOCKING / NON-BLOCKING | |
`;
  fs.writeFileSync(file, body);
  console.log(`✓ 已生成 ${path.relative(PROJECT(), file)}（${Buffer.byteLength(body)} B，上限 15 行口径）`);
  process.exit(EXIT.OK);
}

// ---------- 输出助手 ----------

const T = (s) => `\x1b[36m${s}\x1b[0m`;
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;

// ---------- 子命令 ----------
function cmdSurface(paths) {
  if (!paths.length) die(EXIT.USAGE, '用法：surface <paths...>');
  let controlled = 0;
  for (const p of paths) {
    const rp = rel(path.resolve(PROJECT(), p));
    const { tier, note } = tierOf(rp);
    const tag = tier === 'S' ? Y(tier) : CONTROLLED.has(tier) ? R(tier) : G(tier);
    console.log(`${tag}  ${rp}\n    └─ ${note}`);
    if (CONTROLLED.has(tier)) controlled++;
  }
  console.log(controlled ? `\n${controlled} 个路径在受控面（C1/C2）——写入前必须 check 通过。` : '\n全部为非受控面。');
  process.exit(EXIT.OK);
}

function cmdCheck(args) {
  const q = args.has('--quiet'); // --quiet 单行结论（Agent 消费），人看详尽模式不变
  const woId = args.get('--wo');
  let paths = [...(args.get('--paths') || [])];
  if (args.has('--staged')) {
    const staged = git(['diff', '--cached', '--name-only'], { allowFail: true });
    paths.push(...staged.split('\n').filter(Boolean));
  }
  if (!paths.length) die(EXIT.USAGE, '用法：check [--wo <id>] --paths <p...> | --staged');

  paths = [...new Set(paths.map((p) => rel(path.resolve(PROJECT(), p))))];
  const controlled = paths.filter((p) => CONTROLLED.has(tierOf(p).tier));

  if (!controlled.length) {
    console.log(G('✅ 全部为非受控面（F/T/S），无需 WO。仍需通过 QA 门禁。'));
    process.exit(EXIT.OK);
  }

  // ① 必须有 WO
  if (!woId) {
    console.error(R('⛔ 缺 WO：以下路径在受控面，写入前必须开单（模板 <team-repo>/docs/templates/wo.md）：'));
    for (const p of controlled) console.error(`   ${tierOf(p).tier}  ${p}`);
    process.exit(EXIT.NOLOCK);
  }
  const wo = parseWo(woId);
  if (!wo) {
    console.error(R(`⛔ 找不到 WO：${woId}（workorders.md 表行与 runtime/wo-details/ 均无此单）`));
    process.exit(EXIT.NOLOCK);
  }
  if (wo.closed) {
    console.error(R(`⛔ WO 已归档：${wo.relFile}`));
    process.exit(EXIT.NOLOCK);
  }
  if (!wo.hasRow && wo.inDetails) {
    console.error(R(`⛔ WO 详情单无表行（孤儿）——先认领再执行：guard wo table add --title <任务名> --brief <简述> --id ${woId}`));
    process.exit(EXIT.NOLOCK);
  }
  const activeStatuses = surfaces().wo.statusesActive;
  if (!wo.status || !activeStatuses.includes(wo.status)) {
    console.error(R(`⛔ WO 状态为 ${wo.status || '未知'}（需为 ${activeStatuses.join('/')} 之一）——未核准/已结束的单不可写入：${wo.relFile}`));
    process.exit(EXIT.NOLOCK);
  }

  // ② 路径白名单
  const outside = controlled.filter((p) => !woCovers(wo, p));
  if (outside.length) {
    if (q) { console.error(R(`⛔ check 未过：越权 ${outside.length} 路径（exit 2）——首因 ${outside[0]}`)); process.exit(EXIT.VIOLATION); }
    console.error(R('⛔ 越权：以下路径不在 WO 白名单内（扩大白名单须回团长（风控）核准）：'));
    for (const p of outside) console.error(`   ${tierOf(p).tier}  ${p}`);
    console.error(`   WO：${wo.relFile}`);
    console.error(`   白名单：${wo.globs.join(', ') || '（空）'}`);
    process.exit(EXIT.VIOLATION);
  }

  // ③ 共享锁（面域分片：本单须在 holders 中；无则提示全部在持单）
  const liveHolders = liveLocks();
  const mine = liveHolders.find((h) => sameWo(h.wo, woId));
  if (!mine) {
    if (q) { console.error(R(`⛔ check 未过：缺共享锁（exit 3）——在持 ${liveHolders.length} 单`)); process.exit(EXIT.NOLOCK); }
    console.error(R('⛔ 缺共享锁：本单未持锁（面域分片——仅与在持单面域相交者才需排队）。'));
    if (liveHolders.length) {
      console.error('   当前在持单：');
      for (const h of liveHolders) {
        console.error(`     - ${h.wo}  surfaces=[${holderSurfaces(h).join(', ')}]  剩余 ~${holderLeftMin(h)}min`);
      }
    } else {
      console.error('   当前无锁。');
    }
    console.error('   acquire：node <team-repo>/scripts/aimatrix-guard.mjs lock acquire --wo ' + woId);
    process.exit(EXIT.NOLOCK);
  }

  console.log(G(`✅ check 通过：${controlled.length} 个受控路径均在 WO 白名单内，锁在持（${woId}）。`));
  process.exit(EXIT.OK);
}

function cmdLock(sub, args) {
  const woId = args.get('--wo');
  const ttl = Number(args.get('--ttl')) || surfaces().wo.lockTtlMinutes;
  if (sub === 'status') {
    const holders = liveLocks();
    if (!holders.length) { console.log(G('锁空闲。')); process.exit(EXIT.OK); }
    for (const h of holders) {
      console.log(Y(`锁被持有：holder=${h.wo} surfaces=[${holderSurfaces(h).join(', ')}] 剩余 ~${holderLeftMin(h)}min`));
    }
    process.exit(EXIT.OK);
  }
  if (!woId) die(EXIT.USAGE, '用法：lock <acquire|renew|release> --wo <id>');

  if (sub === 'acquire') {
    const argSurfaces = String(args.get('--surfaces') || '').split(',').map((s) => s.trim()).filter(Boolean);
    // 白名单为唯一真相源：冲突面 = --surfaces ∪ 本 WO 白名单，仅留 C1/C2
    const mySurfaces = controlledGlobs([...argSurfaces, ...(parseWo(woId)?.globs || [])]);
    if (!mySurfaces.length) {
      die(EXIT.USAGE, `⛔ 无面域可持锁：${woId} 的 --surfaces / WO §2 白名单不含任何 C1/C2 路径`);
    }
    const holders = liveLocks();
    const conflicts = [];
    for (const h of holders) {
      if (sameWo(h.wo, woId)) continue; // 本单已有项：替换而非冲突
      const hs = holderSurfaces(h);
      const pairs = [];
      for (const a of mySurfaces) for (const b of hs) if (globsOverlap(a, b)) pairs.push([a, b]);
      if (pairs.length) conflicts.push({ wo: h.wo, pairs });
    }
    if (conflicts.length) {
      console.error(R('⛔ 锁冲突：本单面域与在持单相交（面域分片——不相交可并行，相交须排队，不硬抢）：'));
      for (const c of conflicts) {
        console.error(`   ↔ ${c.wo}`);
        for (const [a, b] of c.pairs) console.error(`       ${a}  ∩  ${b}`);
      }
      process.exit(EXIT.NOLOCK);
    }
    const holder = { wo: woId, surfaces: mySurfaces, acquiredAt: new Date().toISOString(), ttlMinutes: ttl, renewable: true };
    const next = holders.filter((h) => !sameWo(h.wo, woId)).concat(holder); // 替换本 WO 已有项后追加
    writeLockDoc({ holders: next }, `lock acquired by ${woId} (surfaces×${mySurfaces.length})`);
    console.log(G(`✅ 锁已获取：${woId}（面域 ${mySurfaces.length} 条，TTL ${ttl}min，可 renew）`));
    process.exit(EXIT.OK);
  }
  if (sub === 'renew') {
    const holders = liveLocks();
    const hit = holders.find((h) => sameWo(h.wo, woId));
    if (!hit) die(EXIT.NOLOCK, `⛔ 无锁或非本单持有，无法 renew：${woId}`);
    hit.acquiredAt = new Date().toISOString();
    if (args.has('--ttl')) hit.ttlMinutes = ttl;
    writeLockDoc({ holders }, `lock renewed by ${woId}`);
    console.log(G(`✅ 锁已续期：${woId}（重新计时 ${hit.ttlMinutes || ttl}min）`));
    process.exit(EXIT.OK);
  }
  if (sub === 'release') {
    const holders = liveLocks();
    const hit = holders.find((h) => sameWo(h.wo, woId));
    if (!hit) die(EXIT.NOLOCK, `⛔ 非本单持有，无权释放：${woId}`);
    const next = holders.filter((h) => !sameWo(h.wo, woId)); // 只移除本单；绝不释放他人
    writeLockDoc({ holders: next }, `lock released by ${woId}`);
    console.log(G(`✅ 锁已释放：${woId}${next.length ? `（仍有 ${next.length} 单在持）` : ''}`));
    process.exit(EXIT.OK);
  }
  die(EXIT.USAGE, '未知 lock 子命令');
}

function cmdDrScan(args) {
  const woId = args.get('--wo');
  const blockingOnly = args.has('--blocking');
  const drs = scanDrs({ wo: woId, blockingOnly }).concat(scanDrTable({ wo: woId, blockingOnly }));
  const blocking = drs.filter((d) => d.blocking);
  // 精炼铁律（docs/templates/dr.md）：open 单体量上限——创始人要读的就是它，超限直接烧 token
  const DR_MAX = 2.5 * 1024;
  const oversized = [];
  for (const d of drs) {
    let size = 0;
    try { size = fs.statSync(d.file).size; } catch {}
    if (size > DR_MAX) oversized.push({ id: d.id, size });
  }
  for (const d of drs) {
    const tag = d.blocking ? R('BLOCKING') : Y('NON-BLOCK');
    const over = oversized.find((o) => o.id === d.id);
    console.log(`${tag}  ${d.id}  ${d.title}  [${d.relFile}]${over ? R(`  ⚠ ${(over.size / 1024).toFixed(1)}KB > 2.5KB`) : ''}`);
  }
  if (oversized.length) {
    console.error(R(`\n⚠ ${oversized.length} 个 OPEN DR 超出精炼上限（≤2.5KB）：${oversized.map((o) => o.id).join(', ')}`));
    console.error(R('   处置：删掉取证表/方案细则/清单/落地步骤，改为「背景 3-5 句 + 选项(含推荐) + 不做的后果 2-3 句」，细则移入对应文档并在 §7 引用。'));
  }
  if (blocking.length) {
    console.error(R(`\n⛔ ${blocking.length} 个 OPEN 的 BLOCKING DR 未闭环——相关 WO 不得进入下一阶段（章程 T2）。`));
    process.exit(EXIT.DR);
  }
  if (oversized.length) process.exit(EXIT.VIOLATION);
  console.log(G(drs.length ? `\n有 ${drs.length} 个 NON-BLOCKING DR 待答复（不阻塞）。` : '\n无未闭环 DR。'));
  process.exit(EXIT.OK);
}

function lintOne(file) {
  const text = read(file);
  const base = path.basename(file);
  const missing = [];
  const has = (re) => re.test(text);
  if (/-handoff\.md$/i.test(base)) { // 修正：交接单以 -handoff.md 结尾才算；WO slug 内含 handoff 字样的仍是 WO（WO-10 误判回归修复）
    if (!has(/\|\s*WO\s*\|/)) missing.push('字段表 WO');
    if (!has(/^##\s*1\.\s*一句话结论/m)) missing.push('§1 一句话结论');
    if (!has(/^##\s*2\.\s*改动清单/m)) missing.push('§2 改动清单');
    if (!has(/^##\s*3\.\s*验证证据/m)) missing.push('§3 验证证据');
    if (!has(/^##\s*5\.\s*回滚/m)) missing.push('§5 回滚方式');
  } else if (/^WO-/.test(base)) {
    if (!has(/\|\s*\*{0,2}id\*{0,2}\s*\|/)) missing.push('字段表 id');
    if (!has(/\|\s*\*{0,2}状态\*{0,2}\s*\|/)) missing.push('字段表 状态');
    if (!has(/申请人/)) missing.push('申请人');
    if (!has(/执行角色/)) missing.push('执行角色');
    if (!has(/团长|资深风控师/)) missing.push('团长（风控）');
    if (!has(/^##\s*1\..*(目的|背景)/m)) missing.push('§1 目的与背景');
    if (!has(/^##\s*2\./m)) missing.push('§2 面域与路径白名单');
    else {
      const wl = text.split(/^##\s*2\..*$/m)[1]?.split(/^##\s/m)[0] || '';
      if (!/\//.test(wl)) missing.push('§2 白名单至少 1 条路径');
    }
    if (!has(/^##\s*3\..*(变更类型)/m)) missing.push('§3 变更类型');
    if (!has(/^##\s*4\..*(影响面)/m)) missing.push('§4 影响面');
    if (!has(/^##\s*5\..*(验证)/m)) missing.push('§5 验证方式');
    if (!has(/^##\s*6\..*(回滚)/m)) missing.push('§6 回滚方案');
    // 面向 agent 的两条硬纪律（charter §4A.8）：体量上限 + 验证段必须可执行
    if (Buffer.byteLength(text) > 6 * 1024) missing.push(`主文件 ${(Buffer.byteLength(text) / 1024).toFixed(1)}KB 超 6KB 上限（过程叙事请入 journal）`);
    const sec5 = text.split(/^##\s*5\..*$/m)[1]?.split(/^##\s/m)[0] || '';
    if (sec5 && !/`/.test(sec5)) missing.push('§5 需含可执行命令（反引号/代码块）');
  } else if (/^DR-/.test(base)) {
    for (const f of ['提出者', '所属', '决策类型', '阻塞级别', '状态']) {
      if (!has(new RegExp(`\\|\\s*\\*{0,2}${f}\\*{0,2}\\s*\\|\\s*[^|\\s]`))) missing.push(`字段 ${f}`);
    }
    if (!has(/^##\s*1\.\s*问题/m)) missing.push('§1 问题');
    if (!has(/^##\s*3\.\s*选项/m)) missing.push('§3 选项');
    if (!has(/建议默认值/)) missing.push('§4 建议默认值');
    if (!has(/^##\s*5\..*(后果|超时)/m)) missing.push('§5 后果/超时行为');
  } else {
    missing.push('无法识别类型（文件名需以 WO- / DR- 开头或含 handoff）');
  }
  return missing;
}

function cmdWoLint(files) {
  if (!files.length) die(EXIT.USAGE, '用法：wo lint <files...>');
  let bad = 0;
  for (const f of files) {
    const p = path.resolve(PROJECT(), f);
    if (!exists(p)) { console.error(R(`✗ ${f}：文件不存在`)); bad++; continue; }
    const missing = lintOne(p);
    if (missing.length) { console.error(R(`✗ ${f}：缺 ${missing.join('、')}`)); bad++; continue; }
    console.log(G(`✓ ${f}`));
    // §4A.8 主文件字节上限：WO 主文件（非 journal）>6KB 警示，风控可打回
    if (/^WO-/.test(path.basename(p)) && !p.endsWith('.journal.md')) {
      const bytes = fs.statSync(p).size;
      if (bytes > 6144) console.log(Y('  ⚠ 主文件 ' + (bytes / 1024).toFixed(1) + 'KB 超 6KB 上限（charter §4A.8）——过程叙事请 journal 化，风控可打回'));
    }
  }
  if (bad) { console.error(R(`\n${bad} 个文件格式不合规（模板：<team-repo>/docs/templates/）。`)); process.exit(EXIT.FORMAT); }
  console.log(G('\n全部合规。'));
  process.exit(EXIT.OK);
}

function changedSince(since, stagedOnly = false) {
  const out = new Set();
  const push = (t) => t.split('\n').filter(Boolean).forEach((l) => out.add(l.trim()));
  if (since) push(git(['diff', '--name-only', since], { allowFail: true }));
  if (!since || stagedOnly) push(git(['diff', '--cached', '--name-only'], { allowFail: true }));
  if (!since) push(git(['diff', '--name-only'], { allowFail: true }));
  return [...out].map((p) => p.split(' -> ').pop()); // rename 取新路径
}

function teamChangedSince(since) {
  const out = new Set();
  const push = (t) => t.split('\n').filter(Boolean).forEach((l) => out.add(l.trim().split(' -> ').pop()));
  const g = (a) => { try { return execFileSync('git', a, { cwd: TEAM_ROOT, encoding: 'utf8' }); } catch { return ''; } };
  if (since) push(g(['diff', '--name-only', since]));
  push(g(['diff', '--cached', '--name-only']));
  push(g(['diff', '--name-only']));
  return [...out];
}

function cmdSyncCheck(args) {
  const since = args.get('--since');
  const changed = changedSince(since, true);
  if (!changed.length) { console.log(G('无改动，无需 sync-check。')); process.exit(EXIT.OK); }
  const cdRules = surfaces().contractDocs.rules;
  const hits = [];
  for (const p of changed) {
    for (const r of cdRules) {
      if (globToRe(r.pattern).test(p)) hits.push({ doc: p, skills: r.skills });
    }
  }
  if (!hits.length) { console.log(G('本次改动不含 ★ 契约类文档。')); process.exit(EXIT.OK); }
  const skillChanged = teamChangedSince(since).filter((p) => /^aimatrix-[^/]+\//.test(p));
  const problems = hits.filter((h) => !h.skills.some((s) => skillChanged.some((c) => c.startsWith(`${s}/`))));
  if (!problems.length) { console.log(G('★ 契约类文档改动已伴随对应 Skill 同步。')); process.exit(EXIT.OK); }
  console.warn(Y('⚠ sync-check：以下 ★ 契约类文档改了，但未见对应 Role Skill 同步（提示级，交团长（风控例外裁定）裁决）：'));
  for (const h of problems) console.warn(`   ${h.doc} → 应同步：${h.skills.join(' / ')}`);
  process.exit(EXIT.SYNC);
}

function cmdAudit(args) {
  const since = args.get('--since');
  if (!since) die(EXIT.USAGE, '用法：audit --since <sha|HEAD~N>');
  // 收集 since..HEAD 的提交（含 WO 引用则视为有单） + 未提交改动
  // 提交块以 \x1e 起、字段以 \x1f 分隔（%H / %s / %b），文件清单紧随正文、由一个空行分隔。
  // 陷阱：正文自身可能含空行，且 git 在清单尾部还会补换行——所以先去掉尾部换行，
  // 再取「最后一个空行」作分隔。否则正文行会被当成改动文件，落 defaultTier(C2) → 无单写入误报。
  const commits = git(['log', '--pretty=format:%x1e%H%x1f%s%x1f%b', '--name-only', `${since}..HEAD`], { allowFail: true });
  const violations = [];
  const coveredSeen = [];
  const blocks = [];
  for (const chunk of commits.split('\x1e')) {
    if (!chunk) continue;
    const parts = chunk.split('\x1f');
    const subject = parts[1] || '';
    const rest = parts.slice(2).join('\x1f').replace(/\n+$/, '');
    const sep = rest.lastIndexOf('\n\n');
    let body = '';
    let tail = '';
    if (sep >= 0) { body = rest.slice(0, sep); tail = rest.slice(sep + 2); }
    else if (rest.startsWith('\n')) { tail = rest.slice(1); }
    else { body = rest; }
    blocks.push({ msg: `${subject}\t${body}`, files: tail.split('\n').map((s) => s.trim()).filter(Boolean) });
  }

  const allWoFiles = [];
  for (const dir of [WO_DETAILS(), ...['.', 'open', 'closed'].map((d) => path.join(WO_DIR(), d))]) {
    if (!exists(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/^WO-\d{8}-\d{2}.*\.md$/.test(f) && !f.endsWith('.journal.md')) allWoFiles.push(path.join(dir, f));
    }
  }
  // v2：白名单覆盖判定既要看表行（轻单一行即单），也要看详情单
  const woIds = [...new Set([...woTableRows().map((r) => r.c[0]), ...allWoFiles.map((f) => path.basename(f, '.md'))])];
  const wos = woIds.map((id) => parseWo(id)).filter(Boolean);

  const checkPaths = (files, msgRef) => {
    for (const raw of files) {
      const p = rel(path.resolve(PROJECT(), raw));
      const { tier } = tierOf(p);
      if (!CONTROLLED.has(tier)) continue;
      // 提交信息引用了某个真实存在的 WO 且该 WO 白名单覆盖此路径 → 有单
      const refIds = [...new Set((msgRef || '').match(/WO-\d{8}-\d{2}(?:-[\w-]+)?/g) || [])];
      const same = (a, b) => (String(a).match(/^WO-\d{8}-\d{2}/) || [a])[0] === (String(b).match(/^WO-\d{8}-\d{2}/) || [b])[0];
      const viaMsg = refIds.some((id) => wos.some((w) => same(w.id, id) && woCovers(w, p)));
      const viaWo = wos.some((w) => woCovers(w, p));
      if (viaMsg || viaWo) { coveredSeen.push(p); continue; }
      violations.push({ path: p, tier, msg: (msgRef || '').split('\t')[0] || '(未提交改动)' });
    }
  };

  for (const b of blocks) checkPaths(b.files, b.msg);
  checkPaths(changedSince(null, true), '(未提交改动)');

  console.log(`审计范围：${since}..HEAD + 未提交改动`);
  console.log(`受控面变更 ${coveredSeen.length + violations.length} 条，其中有单覆盖 ${coveredSeen.length} 条。`);
  if (violations.length) {
    console.error(R(`\n⛔ 无单写入 ${violations.length} 条（C1/C2 改动未发现任何覆盖它的 WO）：`));
    for (const v of violations) console.error(`   ${v.tier}  ${v.path}   [${v.msg}]`);
    console.error('   处置：立即停手 → 补开 WO（标注 RETRO）→ 补登记（03 §7）。');
    log(`audit: ${violations.length} uncovered controlled changes`);
    process.exit(EXIT.VIOLATION);
  }
  console.log(G('审计通过：未发现无单写入。'));
  const instanceWarns = checkInstances();
  if (instanceWarns.length) {
    console.error(Y(`\n⚠ 实例呼号提醒 ${instanceWarns.length} 条（不阻塞）：`));
    for (const w of instanceWarns) console.error(`   ${w}`);
  }
  process.exit(EXIT.OK);
}

/**
 * guard agents — 专家包一致性体检（DR-20261006：真源纪律 + 包散件完整性）
 * ① 五真源 × 七实例 sync --check（漂移 = 手改实例或漏同步）
 * ② 团队包 settings.json 存在性（历史 5 次丢失）
 * 退出码：0 全绿 · 2 有漂移/缺件（阻塞）
 */
function cmdAgents() {
  const home = process.env.HOME;
  const syncScript = path.join(__dirname, 'expert-sync.mjs');
  let bad = 0;

  console.log(T('== 真源 → 实例 同步（sync --check）=='));
  try {
    execFileSync('node', [syncScript, '--check'], { stdio: 'inherit' });
  } catch {
    bad++;
    console.error(R('   ✗ 存在漂移：禁止手改实例，改真源 members/*.md 后重跑 expert-sync.mjs。'));
  }

  console.log(T('\n== 专家包散件完整性 =='));
  const pkgs = [
    { name: 'ai-matrix-team', needsSettings: true },
    { name: 'aimatrix-team-team-lead', needsSettings: true },
    { name: 'aimatrix-team-product-designer', needsSettings: true },
  ];
  for (const p of pkgs) {
    const dir = path.join(home, '.workbuddy/plugins/marketplaces/my-experts/plugins', p.name);
    const pluginJson = path.join(dir, '.codebuddy-plugin', 'plugin.json');
    if (!exists(pluginJson)) { console.error(R(`   ✗ ${p.name}: plugin.json 缺失`)); bad++; continue; }
    try {
      const meta = JSON.parse(read(pluginJson));
      console.log(`   ✓ ${p.name} v${meta.version}`);
      if (p.needsSettings && !exists(path.join(dir, 'settings.json'))) {
        // 源包新建的 settings.json 会被 WorkBuddy 后台 watcher 在数秒内清掉
        // （实测 t+2s 存活、t+5s 消失；修改已有文件不受影响）。运行时真正加载的是 cache
        // 安装快照——源包缺失时降级查 cache 最新版本快照，快照在即 ⚠ 不计失败。
        let cacheHit = null;
        try {
          const cacheRoot = path.join(home, '.workbuddy/plugins/cache/my-experts', p.name);
          const vers = fs.readdirSync(cacheRoot).filter((v) => !v.includes('.bak') && exists(path.join(cacheRoot, v, 'settings.json'))).sort();
          if (vers.length) cacheHit = vers[vers.length - 1];
        } catch {}
        if (cacheHit) {
          console.log(Y(`   ⚠ ${p.name}: 源包 settings.json 被 watcher 清理，cache 快照 v${cacheHit} 在（运行时以 cache 为准）`));
        } else {
          console.error(R(`   ✗ ${p.name}: settings.json 源包与 cache 快照均缺失（team 型必须 {"agent":"<团队>-team-lead"}）`));
          bad++;
        }
      }
    } catch (e) {
      console.error(R(`   ✗ ${p.name}: plugin.json 解析失败 ${e.message}`)); bad++;
    }
  }

  console.log(T('\n== 团队仓自检（repo-check）=='));
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'aimatrix-repo-check.mjs'), '--quiet'], { stdio: 'inherit' });
  } catch {
    bad++;
    console.error(R('   ✗ 团队仓自检未过（技能 frontmatter / 三层阈值 / 链接 / 修订痕迹）——修完再提交。'));
  }

  if (bad) { log(`agents: ${bad} 项不合规`); process.exit(EXIT.VIOLATION); }
  console.log(G('\n专家包与团队仓体检通过：六实例一致、散件齐全、仓库整洁。'));
  process.exit(EXIT.OK);
}

/**
 * guard role — 智能判定当前身处什么仓（「升级≠发版」的机器判据）
 * 判据（按序）：① 仓根有 members/team-lead.md + scripts/expert-sync.mjs → team-repo；
 *             ② 仓根有 .aimt/ → project；③ 两者皆非 → unknown。
 * 注意：团队仓自身也有 .aimt/（自管理），故 team-repo 判据必须在先。
 * 退出码：0 = team-repo（可发版）· 7 = project（只有升级，严禁 expert-sync）· 1 = unknown
 */
function cmdRole() {
  const i = process.argv.indexOf('--project');
  const root = path.resolve(i > 0 && process.argv[i + 1] ? process.argv[i + 1] : process.cwd());
  const isTeamRepo = exists(path.join(root, 'members', 'team-lead.md')) && exists(path.join(root, 'scripts', 'expert-sync.mjs'));
  if (isTeamRepo) {
    console.log(G(`role: team-repo（${root}）→ 可发版：VERSION 升 + expert-sync 全链 + guard agents 体检`));
    process.exit(EXIT.OK);
  }
  if (exists(path.join(root, '.aimt'))) {
    console.log(Y(`role: project（${root}）→ 只有升级：preflight → git pull 团队仓 → v2 迁移；严禁 expert-sync / VERSION 升版`));
    process.exit(EXIT.PROJECT);
  }
  console.error(R(`role: unknown（${root}）→ 既非团队仓也非已接入项目；接入走 aimatrix-init.mjs`));
  process.exit(EXIT.USAGE);
}

function cmdReport() {
  console.log(T('== 共享锁 =='));
  const holders = liveLocks();
  if (!holders.length) console.log('  空闲');
  for (const h of holders) {
    console.log(`  holder=${h.wo} surfaces=[${holderSurfaces(h).join(', ')}] acquiredAt=${h.acquiredAt} ttl=${h.ttlMinutes || surfaces().wo.lockTtlMinutes}min`);
  }
  console.log(T('\n== 活跃 WO =='));
  const actives = activeWos();
  if (!actives.length) console.log('  无');
  for (const w of actives) console.log(`  ${w.id}  status=${w.status}  executor=${w.executor || '—'}  whitelist=[${w.globs.slice(0, 3).join(', ')}${w.globs.length > 3 ? ' …' : ''}]  DR=[${w.drs.join(', ') || '—'}]`);
  // 僵尸单巡检（I-033）：活动表 WO 白名单基路径在项目内全部不存在 → 疑似资产已迁出，提示交割
  const zombies = actives.filter((w) => {
    const bases = [...new Set(w.globs.map((x) => x.split('*')[0].replace(/\/+.?$/, '').trim()).filter(Boolean))];
    return bases.length > 0 && bases.every((b) => !fs.existsSync(path.join(PROJECT(), b)));
  });
  for (const w of zombies) console.error(Y(`  ⚠ 疑似僵尸单 ${w.id}：白名单基路径全部不存在（资产可能已迁出，请按 09-wo 交割清单置终态归档）`));
  console.log(T('\n== 实例呼号 =='));
  const instanceWarns = checkInstances();
  if (!instanceWarns.length) console.log(G('  通过：无撞号、无未登记呼号。'));
  for (const w of instanceWarns) console.error(Y(`  ⚠ ${w}`));
  console.log(T('\n== 未闭环 DR =='));
  const drs = [...scanDrs({}), ...scanDrTable({})]; // v2：条目块（decisions.md）也是真相源，不能只看旧 open/ 目录
  const b = drs.filter((d) => d.blocking);
  console.log(`  BLOCKING ${b.length} · NON-BLOCKING ${drs.length - b.length}`);
  for (const d of drs) console.log(`  ${d.blocking ? '⛔' : '·'} ${d.id} ${d.title}`);
  process.exit(EXIT.OK);
}

// ---------- 参数解析 ----------
// --project <root> 全局参数：先摘除再分发（PROJECT 也会直接读 process.argv）
// ===== 单表机制（SPEC-20261010-03）：issues 白板 / workorders 表 / decisions 条目块 =====
const ISSUES_FILE = () => path.join(PROJECT(), '.aimt', 'issues.md');
const WO_TABLE = () => path.join(PROJECT(), '.aimt', 'workorders.md');
const DR_TABLE = () => path.join(PROJECT(), '.aimt', 'decisions.md');
const ARCHIVE_DIR = () => path.join(RUNTIME(), 'archive');
const todayStr = () => new Date().toISOString().slice(0, 10);
const ymStr = () => new Date().toISOString().slice(0, 7);

function readOrCreate(file, header) {
  if (!exists(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, header);
  }
  return read(file);
}

// 按 `^## ` 切 h2 条目块；pre = 首个 h2 之前的文件头
function splitBlocks(file, header) {
  const text = readOrCreate(file, header);
  const lines = text.split('\n');
  const blocks = [];
  const pre = [];
  let cur = null;
  for (const ln of lines) {
    if (/^## /.test(ln)) { if (cur) blocks.push(cur); cur = { head: ln, lines: [] }; }
    else if (cur) cur.lines.push(ln);
    else pre.push(ln);
  }
  if (cur) blocks.push(cur);
  return { pre: pre.join('\n').replace(/\n*$/, '\n'), blocks };
}

function writeBlocks(file, pre, blocks) {
  const body = blocks.map((b) => [b.head, ...b.lines].join('\n').replace(/\n*$/, '')).join('\n\n');
  fs.writeFileSync(file, pre.replace(/\n*$/, '\n\n') + body + '\n');
}

// 元数据行（含 `状态:` 的第一行）解析/重建
function parseMeta(b) {
  const line = b.lines.find((l) => /状态:/.test(l)) || '';
  const get = (k) => {
    const m = line.match(new RegExp(`${k}:\\s*([^·]*)`));
    return m ? m[1].trim() : '';
  };
  return { line, get };
}

function archivePath() {
  fs.mkdirSync(ARCHIVE_DIR(), { recursive: true });
  return path.join(ARCHIVE_DIR(), `${ymStr()}.md`);
}

function archiveAppend(block) {
  const f = archivePath();
  if (!exists(f)) fs.writeFileSync(f, '# 归档 · 已闭环单据（append-only）\n\n');
  fs.appendFileSync(f, block.replace(/\n*$/, '\n\n'));
}

/** 顺手归档：wo 表任何写命令收尾调用，把 DONE 行即时移入月度归档（终态即收口，不留滞留窗口；sweep 继续兜底 issues/DR） */
function tidyWoDone() {
  const { lines, head, rows } = woRows();
  const done = rows.filter((r) => r.c[4] === 'DONE');
  if (!done.length) return 0;
  const out = lines.slice(0, head + 2).concat(rows.filter((r) => r.c[4] !== 'DONE').map((r) => r.line));
  fs.writeFileSync(WO_TABLE(), out.join('\n') + '\n');
  for (const r of done) archiveAppend(`## WO ${r.c[0]} ${r.c[1]}（归档 ${todayStr()}）\n简述: ${r.c[2]} · 关联: ${r.c[3]} · 终态: ${r.c[4]} · 处理者: ${r.c[5]} · 更新: ${r.c[7]}`);
  console.log(G(`📦 顺手归档 ${done.length} 条 DONE：${done.map((r) => r.c[0]).join('、')}`));
  return done.length;
}

function requireTableId(id, re, what) {
  if (!re.test(id || '')) die(EXIT.USAGE, `缺合法 ${what} 编号（--id ${what}-…）`);
}

// --- issues ---
const ISSUE_HEADER = '# Issues · 未处理事项白板\n\n> 用户随手记：文末追加 `## 标题` + 一句话即可；agent 一律经 `guard issues add|triage|close|normalize` 写入。\n\n';

function issueBlocks() { return splitBlocks(ISSUES_FILE(), ISSUE_HEADER); }

/** 归档文本里出现过的编号（全局唯一资源：归档占用即作废）。matchAll 取捕获组（无组回退全匹配） */
function idsInArchive(re) {
  const archDir = ARCHIVE_DIR();
  const out = [];
  for (const f of readDirSafe(archDir)) {
    const text = String(read(path.join(archDir, f)));
    for (const m of text.matchAll(re)) out.push(m[1] ?? m[0]);
  }
  return out;
}

function nextIssueId(blocks) {
  // 取号唯一器：在册块 + 归档全扫取 max（I-010：归档后不复用编号）
  let max = 0;
  const bump = (s) => { const m = /^I-(\d+)$/.exec(String(s || '')); if (m) max = Math.max(max, Number(m[1])); };
  for (const b of blocks) { const mm = b.head.match(/^## (I-\d+)/); if (mm) bump(mm[1]); }
  for (const id of idsInArchive(/## ISSUE (I-\d+)/g)) bump(id);
  for (const id of idsInArchive(/## I-\d+/g).map((s) => s.slice(3))) bump(id);
  return `I-${String(max + 1).padStart(3, '0')}`;
}

/** 同步自旋休眠（零依赖；Atomics.wait 不可用时退化忙等） */
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
  catch { const t = Date.now(); while (Date.now() - t < ms) { /* 忙等兜底 */ } }
}

const ISSUES_LOCK = () => path.join(STATE_DIR(), 'issues.lock');

/**
 * 台账写锁：同级 lockfile + O_CREAT|O_EXCL 抢锁，抢不到自旋重试，超时按「锁冲突」退出。
 * 取号（读→算→写）必须在临界区内，否则两条并行 add 会各自算出同一编号、后写者静默覆盖。
 * 纪律：临界区内禁止 die()/process.exit()——process.exit 不跑 finally，会留下死锁文件；
 * 异常路径由 finally 兜底清理。持锁进程被强杀留下的过期锁按 staleMs 自愈摘除。
 */
function withLedgerLock(lockPath, fn, { timeoutMs = 8000, staleMs = 60000 } = {}) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const t0 = Date.now();
  let fd = null;
  while (fd === null) {
    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, `${process.pid} ${new Date().toISOString()}\n`);
    } catch (e) {
      if (e.code !== 'EEXIST') die(EXIT.USAGE, `⛔ 台账写锁不可用（${lockPath}）：${e.message}`);
      let aged = false;
      try { aged = Date.now() - fs.statSync(lockPath).mtimeMs > staleMs; } catch { aged = true; }
      if (aged) { try { fs.unlinkSync(lockPath); } catch { /* 已被他人摘除 */ } continue; }
      if (Date.now() - t0 > timeoutMs) {
        die(EXIT.NOLOCK, `⛔ 台账写锁超时（${timeoutMs}ms）：${rel(lockPath)} 被占用——确认无并发写后删除该锁文件再重试`);
      }
      sleepSync(20);
    }
  }
  try {
    return fn();
  } finally {
    try { fs.closeSync(fd); } catch { /* 忽略 */ }
    try { fs.unlinkSync(lockPath); } catch { /* 已被摘除 */ }
  }
}

function cmdIssues(sub, args) {
  const { pre, blocks } = issueBlocks();
  // 已有真实条目时清掉迁移播种的占位行，避免白板同时显示「无未处理事项」与 OPEN 条目
  const preNoPlaceholder = pre.split('\n').filter((l) => !l.includes('（当前无未处理事项）')).join('\n');
  const write = () => writeBlocks(ISSUES_FILE(), blocks.length ? preNoPlaceholder : pre, blocks);
  if (sub === 'add') {
    const title = args.get('--title');
    if (!title) die(EXIT.USAGE, '用法：issues add --title <标题> [--source <来源>]');
    const source = args.get('--source') || 'agent';
    // 取号 + 落盘 + 回读校验整段进写锁：并行 add 各算同一编号后互相覆盖 = 静默丢单。
    // 回读校验兜住锁外写入（手写批次 / 旧版本进程）：写完读不到目标 id 就重取一次号再报错。
    const got = withLedgerLock(ISSUES_LOCK(), () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const cur = issueBlocks(); // 锁内重读：并发已落盘的块必须参与取号
        const curPre = cur.pre.split('\n').filter((l) => !l.includes('（当前无未处理事项）')).join('\n');
        const id = nextIssueId(cur.blocks);
        cur.blocks.push({
          head: `## ${id} ${title}`,
          // 草稿块自带正文占位：补正文就地改这一行，勿另追加同号块（normalize 会判重号）
          lines: [
            `来源: ${source} ${todayStr().slice(5)} · 状态: OPEN · 去向: — · 更新: ${todayStr()}`,
            '**事实**：（待补）',
          ],
        });
        writeBlocks(ISSUES_FILE(), cur.blocks.length ? curPre : cur.pre, cur.blocks);
        if (read(ISSUES_FILE()).includes(`## ${id} `)) return { id };
      }
      return null;
    });
    if (!got) die(EXIT.FORMAT, `⛔ 取号后回读校验失败：${rel(ISSUES_FILE())} 里读不到刚写入的块——疑似锁外并发写覆盖，请人工核查后重试`);
    console.log(G(`✅ 已登记 ${got.id}：${title}`));
    console.log(Y(`下一步：编辑 ${got.id} 块的「**事实**」行补正文，勿另追加同号块（同号重块 normalize 会判格式错误）。`));
    process.exit(EXIT.OK);
  }
  if (sub === 'normalize') {
    let n = 0;
    for (const b of blocks) {
      const { line, get } = parseMeta(b);
      let head = b.head;
      if (!/^## I-\d+ /.test(head)) { const t = head.replace(/^##\s*/, ''); head = `## ${nextIssueId(blocks)} ${t}`; n++; }
      if (!line) { b.lines.unshift(`来源: 手写 ${todayStr().slice(5)} · 状态: OPEN · 去向: — · 更新: ${todayStr()}`); n++; }
      else if (!/更新:/.test(line)) { b.lines[b.lines.indexOf(line)] = `${line} · 更新: ${todayStr()}`; n++; }
      b.head = head;
    }
    if (n) { write(); console.log(G(`✅ 规范化 ${n} 处。`)); }
    else console.log('无草稿条目，白板已规范。');
    // 同号重块检出：补正文时另追加同号块 → 同一 `## I-<n>` 出现多块，此前 normalize 报「已规范」、
    // audit 不告警，只能人眼发现。放在规范化之后：补齐动作照常落盘，不被重号短路。
    const seen = new Map();
    blocks.forEach((b, i) => {
      const m = b.head.match(/^## (I-\d+)\b/);
      if (!m) return;
      if (!seen.has(m[1])) seen.set(m[1], []);
      seen.get(m[1]).push(`第 ${i + 1} 块「${b.head.replace(/^##\s*/, '').slice(0, 30)}」`);
    });
    const dups = [...seen.entries()].filter(([, where]) => where.length > 1);
    if (dups.length) {
      console.error(R(`⛔ 同号重块 ${dups.length} 个（编号唯一，同一编号只能有一个块）：`));
      for (const [id, where] of dups) console.error(`   ${id} ×${where.length}：${where.join(' / ')}`);
      console.error('   处置：保留首个块抬头，把后出现块的内容并入后删块；确属两件事则改号（编号不复用）。');
      process.exit(EXIT.FORMAT);
    }
    process.exit(EXIT.OK);
  }
  if (sub === 'triage') {
    const id = args.get('--id'); const to = args.get('--to');
    requireTableId(id, /^I-\d+$/, 'I');
    if (!to) die(EXIT.USAGE, '用法：issues triage --id I-xxx --to WO-xxx|DR-xxx|不做 [--note <原因>]');
    const target = to === '不做' ? `不做(${args.get('--note') || '未说明'})` : `→${to}`;
    const b = blocks.find((x) => x.head.startsWith(`## ${id} `));
    if (!b) die(EXIT.FORMAT, `⛔ 找不到 ${id}`);
    const { line, get } = parseMeta(b);
    const merged = [`来源: ${get('来源') || '—'}`, `状态: TRIAGED`, `去向: ${target}`, `更新: ${todayStr()}`].join(' · ');
    if (line) b.lines[b.lines.indexOf(line)] = merged; else b.lines.unshift(merged);
    write();
    console.log(G(`✅ ${id} → TRIAGED（${target}）。收尾后 issues close --id ${id} 归档。`));
    process.exit(EXIT.OK);
  }
  if (sub === 'close') {
    const id = args.get('--id');
    requireTableId(id, /^I-\d+$/, 'I');
    const i = blocks.findIndex((x) => x.head.startsWith(`## ${id} `));
    if (i < 0) die(EXIT.FORMAT, `⛔ 找不到 ${id}`);
    const b = blocks[i];
    const { get } = parseMeta(b);
    const target = get('去向');
    if (!target || target === '—') die(EXIT.VIOLATION, `⛔ ${id} 无去向（先 triage 回填 →WO/→DR/不做），不许闭环`);
    const title = b.head.replace(/^## I-\d+\s*/, '');
    archiveAppend(`## ISSUE ${id} ${title}（归档 ${todayStr()}）\n${b.lines.join('\n').trim()}`);
    blocks.splice(i, 1);
    write();
    console.log(G(`✅ ${id} 已归档（去向 ${target}）。`));
    process.exit(EXIT.OK);
  }
  die(EXIT.USAGE, '用法：issues add --title <t> [--source <s>] | normalize | triage --id I-x --to <目标> | close --id I-x | list');
}

// --- workorders 表 ---
const WO_TABLE_HEADER = '# Workorders · 任务表\n\n> agent 经 `guard wo table add|start|verify|done|block|back` 维护；EXECUTING 即锁定。C1/C2 或 L2 必挂详情单 `runtime/wo-details/<单号>.md`。\n\n| 单号 | 任务名 | 简述 | 关联 | 状态 | 处理者 | 锁定 | 更新 |\n|---|---|---|---|---|---|---|---|\n';

function woRows() {
  const text = readOrCreate(WO_TABLE(), WO_TABLE_HEADER);
  const lines = text.split('\n');
  const head = lines.findIndex((l) => l.startsWith('| 单号'));
  const rows = [];
  for (let i = head + 2; i < lines.length; i++) {
    if (!lines[i].startsWith('|')) break;
    rows.push({ line: lines[i], c: cells(lines[i]) });
  }
  return { lines, head, rows };
}

function cmdWoTable(sub, args) {
  const { lines, head, rows } = woRows();
  const find = (id) => rows.find((r) => r.c[0] === id);
  const save = () => {
    const newLines = [...lines];
    rows.forEach((r, idx) => { newLines[head + 2 + idx] = r.line; });
    fs.writeFileSync(WO_TABLE(), newLines.join('\n'));
  };
  const mutate = (r, patch) => { Object.assign(r.c, patch); r.line = `| ${r.c.join(' | ')} |`; };
  if (sub === 'add') {
    const title = args.get('--title');
    if (!title) die(EXIT.USAGE, '用法：wo table add --title <任务名> --brief <简述≤30字> [--ref <关联>] [--id <WO-YYYYMMDD-NN>]');
    const wanted = args.get('--id');
    let id;
    if (wanted) {
      // --id：认领已存在的详情单号（先 wo new 后补表行的顺序也能对齐，消除两套取号的错位）
      requireTableId(wanted, /^WO-\d{8}-\d{2}$/, 'WO');
      if (find(wanted)) die(EXIT.FORMAT, `⛔ ${wanted} 已在表中`);
      id = wanted;
    } else {
      // 取号统一走 nextWoId()（扫表行+详情单+归档取 max），与 wo new 同源，杜绝重号/错位
      id = nextWoId();
      if (find(id)) die(EXIT.FORMAT, `⛔ 取号冲突：${id} 已在表中——取号器与表不同步，请人工核查`);
    }
    const c = [id, title, args.get('--brief') || '—', args.get('--ref') || '—', 'TODO', '—', '—', todayStr()];
    rows.push({ line: `| ${c.join(' | ')} |`, c });
    save();
    console.log(G(`✅ 已开单 ${id}（TODO）。执行前 wo table start --id ${id} --who <角色#呼号>。`));
    warnOrphanDetails(todayStr().replace(/-/g, ''));
    tidyWoDone();
    process.exit(EXIT.OK);
  }
  if (sub === 'start' || sub === 'verify' || sub === 'done' || sub === 'block' || sub === 'back') {
    const id = args.get('--id');
    requireTableId(id, /^WO-\d{8}-\d{2}$/, 'WO');
    const r = find(id);
    if (!r) die(EXIT.FORMAT, `⛔ 表中无 ${id}`);
    const st = r.c[4];
    if (sub === 'start') {
      if (st === 'EXECUTING') die(EXIT.VIOLATION, `⛔ ${id} 已在执行中（处理者 ${r.c[5]}），锁定不可抢占`);
      if (!['TODO', 'BLOCKED_DR'].includes(st)) die(EXIT.VIOLATION, `⛔ ${id} 状态 ${st} 不可 start`);
      mutate(r, { 4: 'EXECUTING', 5: args.get('--who') || '—', 6: '🔒', 7: todayStr() });
    } else if (sub === 'verify') {
      if (st !== 'EXECUTING') die(EXIT.VIOLATION, `⛔ ${id} 状态 ${st} 不可 verify`);
      mutate(r, { 4: 'VERIFYING', 7: todayStr() });
    } else if (sub === 'done') {
      if (!['EXECUTING', 'VERIFYING', 'BLOCKED_DR'].includes(st)) die(EXIT.VIOLATION, `⛔ ${id} 状态 ${st} 不可 done`);
      mutate(r, { 4: 'DONE', 6: '—', 7: todayStr() });
    } else if (sub === 'back') {
      // 回退：VERIFYING→EXECUTING / EXECUTING→TODO / BLOCKED_DR→TODO；DONE 是终态（已归档）不可退
      if (st === 'DONE') die(EXIT.VIOLATION, `⛔ ${id} 已完结归档，不可回退`);
      if (st === 'VERIFYING') mutate(r, { 4: 'EXECUTING', 7: todayStr() });
      else if (st === 'EXECUTING' || st === 'BLOCKED_DR') mutate(r, { 4: 'TODO', 5: '—', 6: '—', 7: todayStr() });
      else die(EXIT.VIOLATION, `⛔ ${id} 状态 ${st} 无需回退`);
    } else {
      const dr = args.get('--dr') || '—';
      if (st === 'DONE') die(EXIT.VIOLATION, `⛔ ${id} 已完成`);
      mutate(r, { 4: 'BLOCKED_DR', 6: '—', 7: todayStr() });
      if (dr !== '—' && !r.c[3].includes(dr)) r.c[3] = `${r.c[3]}·${dr}`;
      r.line = `| ${r.c.join(' | ')} |`;
    }
    save();
    const after = find(id);
    console.log(G(`✅ ${id} → ${after ? after.c[4] : '?'}`));
    tidyWoDone();
    process.exit(EXIT.OK);
  }
  die(EXIT.USAGE, '用法：wo table add|start|verify|done|block|back');
}

// --- decisions 条目块 ---
const DR_TABLE_HEADER = '# Decisions · 决策请求\n\n> agent 产生（`guard dr add`）；用户唯一动作 = 改「回填」行（`ZEO 10-11 选2`）。\n\n';

function drBlocks() { return splitBlocks(DR_TABLE(), DR_TABLE_HEADER); }

function nextDrId(all) {
  const date = todayStr().replace(/-/g, '');
  let max = 0;
  const bump = (s) => { const m = new RegExp(`DR-${date}-(\\d{3})`).exec(String(s || '')); if (m) max = Math.max(max, Number(m[1])); };
  for (const b of all) bump(b.head);
  const closedDir = DR_CLOSED();
  if (exists(closedDir)) for (const f of fs.readdirSync(closedDir)) bump(f);
  for (const id of idsInArchive(new RegExp(`DR-${date}-\\d{3}`, 'g'))) bump(id); // 归档占用即作废，防复用
  return `DR-${date}-${String(max + 1).padStart(3, '0')}`;
}

function cmdDrAdd(args) {
  const title = args.get('--title');
  const opts = many(args.get('--opt'));
  if (!title || opts.length < 2) die(EXIT.USAGE, '用法：dr add --title <问题> --opt <方案1> --opt <方案2> [--opt <方案3>] [--recommend <序号>] [--ref <关联>] [--blocking]');
  const rec = args.get('--recommend') || '—';
  const blocking = args.has('--blocking');
  // 并发防护：写前以盘上最新内容复检（相邻两次 dr add / 多会话同时登记），撞号→重取；基底取最新读，防覆盖丢条目
  for (let attempt = 0; attempt < 3; attempt++) {
    const { pre, blocks } = drBlocks();
    const id = nextDrId(blocks);
    const fresh = drBlocks();
    if (fresh.blocks.some((b) => b.head.startsWith(`## ${id} `))) continue;
    const base = fresh.blocks.length > blocks.length ? fresh : { pre, blocks };
    const lines = ['方案：', ...opts.map((o, i) => `${i + 1}. ${o}`), `推荐: ${rec} · 关联: ${args.get('--ref') || '—'} · 状态: OPEN · 阻塞: ${blocking ? 'BLOCKING' : 'NON-BLOCKING'} · 更新: ${todayStr()}`, '回填: （待答复，直接改本行）'];
    base.blocks.push({ head: `## ${id} ${title}`, lines });
    writeBlocks(DR_TABLE(), base.pre, base.blocks);
    console.log(G(`✅ 已落 DR ${id}（${blocking ? 'BLOCKING' : 'NON-BLOCKING'}）：${title}`));
    process.exit(EXIT.OK);
  }
  die(EXIT.FORMAT, '⛔ 取号冲突：连续 3 次复检撞号——有并发写入，请稍后重试');
}

// decisions.md 条目块扫描（并回填 decisions table）
function scanDrTable({ wo, blockingOnly } = {}) {
  const out = [];
  if (!exists(DR_TABLE())) return out;
  const { blocks } = drBlocks();
  for (const b of blocks) {
    const m = b.head.match(/^## (DR-\d{8}-\d{3})\s+(.*)$/);
    if (!m) continue;
    const meta = b.lines.find((l) => /状态:/.test(l)) || '';
    const get = (k) => { const mm = meta.match(new RegExp(`${k}:\\s*([^·]*)`)); return mm ? mm[1].trim() : ''; };
    const status = get('状态') || 'OPEN';
    const blocking = get('阻塞').includes('BLOCKING') && !/NON/i.test(get('阻塞'));
    if (status !== 'OPEN') continue;
    if (blockingOnly && !blocking) continue;
    if (wo && !get('关联').includes(wo)) continue;
    out.push({ id: m[1], title: m[2], blocking, relFile: rel(DR_TABLE()), file: DR_TABLE(), isBlock: true, status });
  }
  return out;
}

// --- archive ---
function cmdArchive(sub, args) {
  if (sub === 'sweep') {
    const problems = [];
    const cutoff = Date.now() - 48 * 3600 * 1000;
    const ageOf = (d) => { const t = new Date(d).getTime(); return Number.isNaN(t) ? Infinity : Date.now() - t; };
    const { blocks: iss } = issueBlocks();
    for (const b of iss) {
      const { get } = parseMeta(b);
      if (get('状态') === 'TRIAGED' && ageOf(get('更新')) > 48 * 3600 * 1000) problems.push(`issues: ${b.head.replace(/^##\s*/, '')}（TRIAGED 超 48h 未归档）`);
      if (get('状态') === 'TRIAGED' && (!get('去向') || get('去向') === '—') && ageOf(get('更新')) > 7 * 24 * 3600 * 1000) problems.push(`issues: ${b.head.replace(/^##\s*/, '')}（TRIAGED 超 7 天无去向）`);
    }
    const { rows: wrows } = woRows();
    for (const r of wrows) {
      if (r.c[4] === 'DONE' && ageOf(r.c[7]) > 48 * 3600 * 1000) problems.push(`workorders: ${r.c[0]}（DONE 超 48h 未归档）`);
    }
    const { blocks: drs } = drBlocks();
    for (const b of drs) {
      const meta = b.lines.find((l) => /状态:/.test(l)) || '';
      const get = (k) => { const mm = meta.match(new RegExp(`${k}:\\s*([^·]*)`)); return mm ? mm[1].trim() : ''; };
      if (['ANSWERED', 'DEFERRED', 'EXPIRED', 'WITHDRAWN'].includes(get('状态')) && ageOf(get('更新')) > 48 * 3600 * 1000) problems.push(`decisions: ${b.head.replace(/^##\s*/, '')}（${get('状态')} 超 48h 未归档）`);
    }
    if (problems.length) {
      console.error(R(`\n⚠ ${problems.length} 条终态条目滞留活动表：`));
      for (const p of problems) console.error(`  - ${p}`);
      console.error('   处置：issues close / archive move --kind <issue|wo|dr> --id <编号>');
      process.exit(EXIT.VIOLATION);
    }
    console.log(G('✅ 无滞留：活动表干净。'));
    process.exit(EXIT.OK);
  }
  if (sub === 'move') {
    const kind = args.get('--kind'); const id = args.get('--id');
    if (!['issue', 'wo', 'dr'].includes(kind)) die(EXIT.USAGE, '用法：archive move --kind issue|wo|dr --id <编号>');
    if (kind === 'wo') {
      const { lines, head, rows } = woRows();
      const i = rows.findIndex((r) => r.c[0] === id);
      if (i < 0) {
        // 幂等：行已不在表但归档里有 → 视为成功（兼容既有 done→archive move 流程，重复跑不炸）
        const af = archivePath();
        if (exists(af) && read(af).includes(`## WO ${id} `)) { console.log(G(`✅ ${id} 已归档（幂等）。`)); process.exit(EXIT.OK); }
        die(EXIT.FORMAT, `⛔ 表中无 ${id}`);
      }
      const r = rows[i];
      if (!['DONE'].includes(r.c[4])) die(EXIT.VIOLATION, `⛔ ${id} 状态 ${r.c[4]} 非终态（DONE 才可归档）`);
      archiveAppend(`## WO ${id} ${r.c[1]}（归档 ${todayStr()}）\n简述: ${r.c[2]} · 关联: ${r.c[3]} · 终态: ${r.c[4]} · 处理者: ${r.c[5]} · 更新: ${r.c[7]}`);
      rows.splice(i, 1);
      const out = lines.slice(0, head + 2).concat(rows.map((rr) => rr.line));
      fs.writeFileSync(WO_TABLE(), out.join('\n') + '\n');
      console.log(G(`✅ ${id} 已归档。`));
      process.exit(EXIT.OK);
    }
    const file = kind === 'issue' ? ISSUES_FILE() : DR_TABLE();
    const { pre, blocks } = splitBlocks(file, kind === 'issue' ? ISSUE_HEADER : DR_TABLE_HEADER);
    const kindTag = kind === 'issue' ? 'ISSUE' : 'DR';
    const i = blocks.findIndex((b) => b.head.startsWith(`## ${id} `));
    if (i < 0) {
      const af = archivePath();
      if (exists(af) && read(af).includes(`## ${kindTag} ${id} `)) { console.log(G(`✅ ${id} 已归档（幂等）。`)); process.exit(EXIT.OK); }
      die(EXIT.FORMAT, `⛔ 找不到 ${id}`);
    }
    const b = blocks[i];
    const title = b.head.replace(/^##\s*[^ ]+\s*/, '');
    archiveAppend(`## ${kindTag} ${id} ${title}（归档 ${todayStr()}）\n${b.lines.join('\n').trim()}`);
    blocks.splice(i, 1);
    writeBlocks(file, pre, blocks);
    console.log(G(`✅ ${id} 已归档。`));
    process.exit(EXIT.OK);
  }
  die(EXIT.USAGE, '用法：archive move --kind <k> --id <编号> | archive sweep');
}


const rawArgv = process.argv.slice(2);
const pi = rawArgv.indexOf("--project");
if (pi >= 0) rawArgv.splice(pi, 2);
const argv = rawArgv;
const cmd = argv[0];
const rest = argv.slice(1);
const args = new Map();
const positional = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === '--staged' || a === '--blocking' || a === '--quiet') { args.set(a, true); continue; }
  if (a.startsWith('--')) {
    if (a === '--json') { args.set(a, true); continue; }
    if (a === '--paths' || a === '--opt') {
      // --paths / --opt 后跟 1..N 个值，直到下一个 --flag；--opt 多次出现时累加
      const vals = [];
      let j = i + 1;
      for (; j < rest.length && !rest[j].startsWith('--'); j++) vals.push(rest[j]);
      args.set(a, a === '--opt'
        ? (args.get(a) || []).concat(vals)
        // --paths 与 --surfaces 同口径：逐值按逗号切分（check --paths a,b,c 不再整串当一条路径）
        : (args.get(a) || []).concat(vals).flatMap((v) => String(v).split(',').map((s) => s.trim()).filter(Boolean)));
      i = j - 1;
      continue;
    }
    args.set(a, rest[i + 1]);
    i++;
  } else positional.push(a);
}

// ===== 启动钩子：v2 三表自动迁移（SPEC-20261010-03）=====
// marker（runtime/state/v2-migrated）缺失且有旧单据（open DR / INDEX.md）→ 静默升级一次；
// 纯新项目 → 写 marker 即走；失败只提示不阻断 guard 主流程。
try {
  // 软解析项目根（同 PROJECT() 的候选序，但解析不到 → null，不 die）：钩子在任意 cwd 都不得阻断
  const sr = () => { const p = process.argv.indexOf('--project'); const c = p > 0 && process.argv[p + 1] ? path.resolve(process.argv[p + 1]) : process.env.AIM_PROJECT_ROOT ? path.resolve(process.env.AIM_PROJECT_ROOT) : process.cwd(); return fs.existsSync(path.join(c, '.aimt')) || fs.existsSync(path.join(c, '.ai-matrix-team')) ? c : null; };
  const softRoot = sr();
  if (softRoot) {
    const mtScript = path.join(TEAM_ROOT, 'scripts', 'aimatrix-migrate-v2.mjs');
    const projMatrix = path.join(softRoot, '.aimt');
    const legacyMatrix = path.join(softRoot, '.ai-matrix-team');
    const mtMarker = path.join(projMatrix, 'runtime', 'state', 'v2-migrated');
    // surfaces.json 漂移（默认 wo 块有新增状态 / 残留旧措辞 / 残留旧目录名模式）也触发一次迁移自愈
    const surfacesDrifted = () => {
      try {
        const pf = path.join(projMatrix, 'surfaces.json');
        if (!fs.existsSync(pf)) return false;
        const ptxt = fs.readFileSync(pf, 'utf8');
        if (/资深风控师/.test(ptxt) || /\.ai-matrix-team/.test(ptxt)) return true;
        const dw = JSON.parse(fs.readFileSync(path.join(TEAM_ROOT, 'scripts', 'surfaces-default.json'), 'utf8')).wo;
        const pw = JSON.parse(ptxt).wo || {};
        return (dw?.statusesActive || []).some((s) => !(pw.statusesActive || []).includes(s));
      } catch { return false; }
    };
    // 触发：新目录缺 v2 marker / surfaces 漂移 / 旧目录还在（未做 .aimt 改名迁移）
    if (fs.existsSync(mtScript) && (fs.existsSync(projMatrix) || fs.existsSync(legacyMatrix)) && (!fs.existsSync(mtMarker) || surfacesDrifted() || fs.existsSync(legacyMatrix))) {
      const r = spawnSync(process.execPath, [mtScript, '--project', softRoot, '--auto'], { encoding: 'utf8' });
      if (r.status === 0 && /➜|✎/.test(r.stdout || '')) console.error((r.stdout || '').trim());
      else if (r.status !== 0) console.error(`⚠ v2 自动迁移失败（不影响本命令）：${((r.stderr || r.stdout || '').trim().split('\n').pop() || '').slice(0, 200)}——可显式运行 aimatrix-migrate-v2.mjs 重试`);
    }
    // guide.md（原 AIM-T-Guide.md）保鲜：受管范本，项目副本缺失/落后/仍用旧名即覆盖
    try {
      const guideTpl = path.join(TEAM_ROOT, 'templates', 'guide.md');
      const guideDst = path.join(projMatrix, 'guide.md');
      const guideLegacy = path.join(projMatrix, 'AIM-T-Guide.md');
      if (fs.existsSync(guideTpl)) {
        const t = fs.readFileSync(guideTpl, 'utf8');
        let p = '';
        try { p = fs.readFileSync(guideDst, 'utf8'); } catch { /* 缺失即携带 */ }
        if (fs.existsSync(guideLegacy)) {
          try { const lp = fs.readFileSync(guideLegacy, 'utf8'); if (lp !== t) p = lp; } catch { /* 读不了当缺失 */ }
        }
        if (p !== t || fs.existsSync(guideLegacy)) {
          fs.writeFileSync(guideDst, t);
          if (fs.existsSync(guideLegacy)) fs.rmSync(guideLegacy);
          console.error('✎ guide.md 已随 AIM-T 更新（受管文件，项目补充写在项目侧流程文档）');
        }
      }
    } catch { /* 保鲜钩子绝不阻断主流程 */ }
  }
} catch { /* 迁移钩子绝不阻断主流程 */ }

try {
  switch (cmd) {
    case '--version':
    case '-v': {
      const vf = path.join(TEAM_ROOT, 'VERSION');
      console.log(exists(vf) ? read(vf).trim() : 'unknown');
      process.exit(EXIT.OK);
    }
    case 'surface': cmdSurface(positional); break;
    case 'check': cmdCheck(args); break;
    case 'lock':
      if (!positional.length) die(EXIT.USAGE, '用法：lock <status|acquire|renew|release> --wo <id>');
      cmdLock(positional[0], args);
      break;
    case 'dr': {
      if (positional[0] === 'scan') { cmdDrScan(args); break; }
      if (positional[0] === 'add') { cmdDrAdd(args); break; }
      die(EXIT.USAGE, '用法：dr scan [--wo <id>] [--blocking] | dr add --title <问题> --opt <方案1> --opt <方案2> [--opt <方案3>] [--recommend <序号>] [--ref <关联>] [--blocking]');
      break;
    }
    case 'issues':
      if (!positional.length) die(EXIT.USAGE, '用法：issues <add|normalize|triage|close>');
      cmdIssues(positional[0], args);
      break;
    case 'archive':
      if (!positional.length) die(EXIT.USAGE, '用法：archive <move|sweep>');
      cmdArchive(positional[0], args);
      break;
    case 'wo':
      if (positional[0] === 'new') { cmdWoNew(args); break; }
      if (positional[0] === 'lint') { cmdWoLint(positional.slice(1)); break; }
      if (positional[0] === 'journal') { cmdWoJournal(args); break; }
      if (positional[0] === 'table') {
        if (!positional[1]) die(EXIT.USAGE, '用法：wo table <add|start|verify|done|block|back>');
        cmdWoTable(positional[1], args);
        break;
      }
      die(EXIT.USAGE, '用法：wo new --slug <kebab> | wo lint <files...> | wo journal --wo <id> --who <who> --what <text> | wo table <add|start|verify|done|block|back>');
    case 'handoff': cmdHandoffNew(args); break;
    case 'sync-check': cmdSyncCheck(args); break;
    case 'audit': cmdAudit(args); break;
    case 'report': cmdReport(); break;
    case 'instances': cmdInstances(); break;
    case 'stats': cmdStats(); break;
    case 'agents': cmdAgents(); break;
    case 'role': cmdRole(); break;
    default:
      die(EXIT.USAGE, `未知命令 ${cmd ?? ''}。可用：surface | check [--quiet] | lock | dr scan | dr add | issues | wo new | wo table | wo lint | wo journal | archive | handoff | instances | stats | sync-check | audit | report | agents | role`);
  }
} catch (e) {
  die(EXIT.USAGE, `guard 异常：${e.stack || e.message}`);
}
