#!/usr/bin/env node
/**
 * aimatrix-install.mjs · AI Matrix Team 三平台 Skill 桥安装器
 *
 * 暴露原则：**只暴露一个用户可用的技能入口**——
 *   真源：<team-repo>/SKILL.md（安装器，面向用户的唯一入口）
 *   桥接：三个平台各建一个零内容重复的入口，正文共用同一份 SKILL.md：
 *     workbuddy → <project>/.workbuddy/skills/ai-matrix-team/SKILL.md（真目录 + 文件级软链）
 *     claude    → <project>/.claude/skills/ai-matrix-team/SKILL.md（同款布局；Claude Code 原生 SKILL.md 格式）
 *     codex     → <project>/AGENTS.md（壳文件，带 managed 标记，指向 SKILL.md；Codex 自动加载仓根 AGENTS.md）
 *   布局用「真目录 + 链单个 SKILL.md 文件」而不是链整个仓根：平台若递归扫描技能目录，
 *   链仓根会把 9 个岗位技能再次暴露出来；文件级链接在递归 / 非递归两种行为下都只暴露一个入口。
 * 岗位技能（aimatrix-guard / aimatrix-decision 等）是 agent 内部分工用的，**不进任何技能列表**；
 * agent 需要岗位细则时按团队仓路径直读 <team-repo>/aimatrix-<role>/SKILL.md。
 *
 * 为什么必须软链而不是复制：真相源要跟着 git 走（可 review / 可回滚 / 可被 CI 读）；
 * 复制 = 两份副本漂移（本项目 Charter P2 明令禁止）。
 *
 * 用法：
 * node <team-repo>/scripts/aimatrix-install.mjs                       # 三平台桥全建（幂等；自动清理旧版 9 链布局）
 * node <team-repo>/scripts/aimatrix-install.mjs --target workbuddy    # 只装单平台（workbuddy|claude|codex|all）
 * node <team-repo>/scripts/aimatrix-install.mjs --check               # 只校验不改动（CI / 巡检用）
 * node <team-repo>/scripts/aimatrix-install.mjs --status              # 打印当前桥接状态
 * node <team-repo>/scripts/aimatrix-install.mjs --uninstall           # 只删自己建的桥（不碰别的东西）
 * node <team-repo>/scripts/aimatrix-install.mjs --force               # 冲突时把旧物改名为 .bak-<ts> 后重建
 * node <team-repo>/scripts/aimatrix-install.mjs --json                # 机器可读输出
 * node <team-repo>/scripts/aimatrix-install.mjs --project <dir>       # 指定目标项目根
 *
 * 退出码：0 全部就绪 · 1 有缺失/漂移/旧布局残留 · 2 有冲突且未处理 · 3 用法错误
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEGACY_PREFIX = 'aimatrix-'; // 旧版 9 链布局的项目级链接名前缀（只清理指向本仓的）

// ---------------------------------------------------------------- 参数

function parseArgs(argv) {
  const args = { mode: 'install', target: 'all', force: false, json: false, project: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--check': args.mode = 'check'; break;
      case '--status': args.mode = 'status'; break;
      case '--uninstall': args.mode = 'uninstall'; break;
      case '--install': args.mode = 'install'; break;
      case '--force': args.force = true; break;
      case '--json': args.json = true; break;
      case '--target': {
        const v = argv[++i];
        if (!['workbuddy', 'claude', 'codex', 'all'].includes(v)) throw new Error(`--target 只支持 workbuddy|claude|codex|all，收到：${v}`);
        args.target = v;
        break;
      }
      case '--root':
      case '--project': args.project = argv[++i]; break;
      case '-h':
      case '--help': args.mode = 'help'; break;
      default:
        throw new Error(`未知参数：${a}（试试 --help）`);
    }
  }
  return args;
}

// ---------------------------------------------------------------- 工具

const exists = (p) => {
  try { fs.lstatSync(p); return true; } catch { return false; }
};

const TEAM_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 唯一真源根（本仓）
const SOURCE_SKILL = path.join(TEAM_ROOT, 'SKILL.md');

if (!exists(SOURCE_SKILL)) {
  console.error(`真源损坏：${TEAM_ROOT} 下没有 SKILL.md`);
  process.exit(1);
}

const ENTRY_NAME = 'ai-matrix-team'; // 技能目录名（= 根 SKILL.md 的 name 字段）
const AGENTS_MARKER = '<!-- managed-by: ai-matrix-team (aimatrix-install) -->';
const readLinkTarget = (p) => {
  try { return fs.readlinkSync(p); } catch { return null; }
};

function makeBackup(p) {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const bak = `${p}.bak-${ts}`;
  fs.renameSync(p, bak);
  return bak;
}

/** 目标项目根：--project 显式 > cwd 含平台痕迹 > cwd */
function resolveTarget(args) {
  if (args.project) return path.resolve(args.project);
  const has = (p) => exists(path.join(process.cwd(), p));
  return (has('.workbuddy') || has('.claude') || has('AGENTS.md')) ? process.cwd() : process.cwd();
}

/** Codex 壳文件内容（零重复：正文真源是团队仓 SKILL.md，这里只有指针） */
function agentsContent(root) {
  const teamRel = path.relative(root, TEAM_ROOT);
  return `${AGENTS_MARKER}
# ai-matrix-team · 通用 Agent 入口（壳）

本文件由 ai-matrix-team 安装器生成，**只是壳**——正文唯一真源：\`${teamRel}/SKILL.md\`。

触发词「接入 / 安装 / 升级 / 检查 / 发版」×「ai-matrix-team / 专家团 / AIM」命中时：
先读 \`${teamRel}/SKILL.md\`，严格按其「分支判断」执行（已接入走「升级 / 体检」，未接入走「安装步骤」），不要凭本壳自由发挥。

- 岗位细则：按路径直读 \`${teamRel}/aimatrix-<role>/SKILL.md\`（不进任何技能列表）
- 成员档案：\`${teamRel}/members/\`
- 门禁体检：\`node ${teamRel}/scripts/aimatrix-guard.mjs --project <本项目根> <子命令>\`
`;
}

// ---------------------------------------------------------------- 各目标 inspect / act

const skillsEntry = (root, base) => {
  const dir = path.join(root, base, 'skills', ENTRY_NAME);
  const file = path.join(dir, 'SKILL.md');
  return { dir, file, wantRel: path.relative(dir, SOURCE_SKILL) };
};

/** 文件级软链桥（workbuddy / claude 共用布局） */
function inspectLinkBridge(root, base) {
  const { dir, file, wantRel } = skillsEntry(root, base);
  let state, detail = '';
  if (!exists(dir)) { state = 'missing'; detail = '入口目录不存在'; }
  else if (!exists(file)) { state = 'missing'; detail = '目录存在但缺 SKILL.md'; }
  else {
    const st = fs.lstatSync(file);
    if (!st.isSymbolicLink()) { state = 'conflict'; detail = 'SKILL.md 是真实文件副本（不是我们建的软链）'; }
    else {
      const resolved = path.resolve(dir, readLinkTarget(file));
      if (resolved !== SOURCE_SKILL) { state = 'conflict'; detail = `软链指向别处：${readLinkTarget(file)}`; }
      else { state = 'ok'; detail = `→ ${readLinkTarget(file)}`; }
    }
  }
  // 旧版 9 链残留：<base>/skills/aimatrix-* 且指向本仓
  const skillsDir = path.join(root, base, 'skills');
  let legacy = [];
  if (exists(skillsDir)) {
    legacy = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isSymbolicLink() && e.name.startsWith(LEGACY_PREFIX))
      .map((e) => path.join(skillsDir, e.name))
      .filter((p) => {
        const t = readLinkTarget(p);
        return t && path.resolve(skillsDir, t).startsWith(TEAM_ROOT);
      });
  }
  return { kind: 'link', dir, file, wantRel, state, detail, legacy };
}

function actLinkBridge(rec, args, io, base) {
  for (const p of rec.legacy) { // 只清指向本仓的（安全），一个入口取代
    fs.unlinkSync(p);
    io.line(`  - legacy ${path.basename(p)}（旧版岗位技能链，改由 agent 按路径直读）`);
  }
  if (rec.state === 'ok') { io.line(`  = ${base}/${ENTRY_NAME}/SKILL.md ${rec.detail}`); return { changed: 0, conflicts: 0 }; }
  if (rec.state === 'conflict' && !args.force) {
    io.line(`  ! ${base} 冲突：${rec.detail}（确认可弃再加 --force，旧物会改名备份）`);
    return { changed: 0, conflicts: 1 };
  }
  if (rec.state === 'conflict') {
    const bak = makeBackup(rec.file);
    io.line(`  ! ${base} 冲突已备份 → ${path.basename(bak)}`);
  }
  fs.mkdirSync(rec.dir, { recursive: true });
  if (exists(rec.file)) fs.unlinkSync(rec.file);
  fs.symlinkSync(rec.wantRel, rec.file, 'file');
  io.line(`  + ${base}/${ENTRY_NAME}/SKILL.md → 团队仓根 SKILL.md`);
  return { changed: 1, conflicts: 0 };
}

/** Codex 壳桥（AGENTS.md） */
function inspectAgentsBridge(root) {
  const file = path.join(root, 'AGENTS.md');
  let state, detail = '';
  if (!exists(file)) { state = 'missing'; detail = 'AGENTS.md 不存在'; }
  else {
    const head = fs.readFileSync(file, 'utf8').slice(0, 200);
    if (head.includes(AGENTS_MARKER)) { state = 'ok'; detail = '壳文件在位（本安装器管理）'; }
    else { state = 'conflict'; detail = 'AGENTS.md 已存在且非本安装器生成（不擅动）'; }
  }
  return { kind: 'agents', file, state, detail };
}

function actAgentsBridge(rec, args, io, root) {
  if (rec.state === 'ok') {
    // 壳内容随团队仓相对路径变化刷新（仓库搬家后指针会失效）
    const want = agentsContent(root);
    if (fs.readFileSync(rec.file, 'utf8') !== want) {
      fs.writeFileSync(rec.file, want);
      io.line(`  ~ codex/AGENTS.md 已刷新（真源相对路径校正）`);
      return { changed: 1, conflicts: 0 };
    }
    io.line(`  = codex/AGENTS.md ${rec.detail}`);
    return { changed: 0, conflicts: 0 };
  }
  if (rec.state === 'conflict' && !args.force) {
    io.line(`  ! codex 冲突：${rec.detail}（如确认可弃再加 --force；或请手工把 SKILL.md 指引合并进现有 AGENTS.md）`);
    return { changed: 0, conflicts: 1 };
  }
  if (rec.state === 'conflict') {
    const bak = makeBackup(rec.file);
    io.line(`  ! codex 冲突已备份 → ${path.basename(bak)}`);
  }
  fs.writeFileSync(rec.file, agentsContent(root));
  io.line(`  + codex/AGENTS.md 壳已生成 → 指向团队仓 SKILL.md`);
  return { changed: 1, conflicts: 0 };
}

// ---------------------------------------------------------------- 汇总

const TARGETS = ['workbuddy', 'claude', 'codex'];
const basesFor = (t) => (t === 'all' ? TARGETS : [t]);

function inspectAll(root, targets) {
  return targets.map((t) => (t === 'codex' ? { target: t, rec: inspectAgentsBridge(root) } : { target: t, rec: inspectLinkBridge(root, t === 'claude' ? '.claude' : '.workbuddy') }));
}

function uninstallAll(root, targets, io) {
  let removed = 0;
  for (const { target, rec } of inspectAll(root, targets)) {
    if (rec.kind === 'link') {
      for (const p of rec.legacy) { fs.unlinkSync(p); io.line(`  - ${target} legacy ${path.basename(p)}`); removed++; }
      if (rec.state === 'ok') {
        fs.unlinkSync(rec.file);
        io.line(`  - ${target}/${ENTRY_NAME}/SKILL.md`);
        removed++;
        const rest = fs.readdirSync(rec.dir).filter((n) => !n.startsWith('.bak-'));
        if (rest.length === 0) { fs.rmdirSync(rec.dir); io.line(`  - ${target}/${ENTRY_NAME}/（空目录）`); }
      }
    } else if (rec.state === 'ok') {
      fs.unlinkSync(rec.file);
      io.line(`  - codex/AGENTS.md（壳）`);
      removed++;
    }
  }
  return removed;
}

// ---------------------------------------------------------------- 输出

function createIo(jsonMode) {
  const lines = [];
  const io = {
    lines,
    line: (s) => { lines.push(s); if (!jsonMode) console.log(s); },
    warn: (s) => { lines.push(s); if (!jsonMode) console.log(`  ! ${s}`); }
  };
  return io;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`参数错误：${e.message}`);
    process.exit(3);
  }

  const root = resolveTarget(args);
  const targets = basesFor(args.target);
  const io = createIo(args.json);

  if (args.mode === 'help') {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').trim());
    process.exit(0);
  }

  io.line(`AI Matrix Skill 三平台桥安装器 · 真源根：${TEAM_ROOT} · 目标项目：${root} · 目标：${targets.join(',')}`);
  io.line(`模式：${args.mode}${args.force ? ' · --force' : ''}`);
  io.line('');

  let exit = 0;
  let payload = {};

  if (args.mode === 'install') {
    let changed = 0, conflicts = 0, legacy = 0;
    for (const { target, rec } of inspectAll(root, targets)) {
      const r = rec.kind === 'link' ? actLinkBridge(rec, args, io, target) : actAgentsBridge(rec, args, io, root);
      changed += r.changed; conflicts += r.conflicts; legacy += (rec.legacy?.length || 0);
    }
    payload = { changed, conflicts, legacyRemoved: legacy };
    io.line('');
    io.line(`新键/刷新 ${changed} 处 · 旧布局清理 ${legacy} 处 · 未处理冲突 ${conflicts} 处`);
    if (conflicts > 0) {
      io.warn('有同名旧物挡路（详见上行）。确认可弃再加 --force（旧物会改名备份，不会直接删除）。');
      exit = 2;
    }
  } else if (args.mode === 'check' || args.mode === 'status') {
    const recs = inspectAll(root, targets);
    payload = recs.map(({ target, rec }) => ({ target, state: rec.state, legacy: rec.legacy?.length || 0 }));
    for (const { target, rec } of recs) {
      io.line(`  ${target}: ${rec.state}${rec.detail ? ' — ' + rec.detail : ''}${rec.legacy?.length ? `（legacy ${rec.legacy.length} 条）` : ''}`);
    }
    const bad = recs.some(({ rec }) => rec.state !== 'ok' || (rec.legacy?.length || 0) > 0);
    if (args.mode === 'check' && bad) exit = 1;
  } else if (args.mode === 'uninstall') {
    const removed = uninstallAll(root, targets, io);
    payload = { removed };
    io.line('');
    io.line(`已移除 ${removed} 处（真相源团队仓未被触动）`);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({ ...payload, exit }, null, 2) + '\n');
  }
  if (exit === 0 && args.mode !== 'check') {
    if (!args.json) io.line('完成。可用 --check 复验。');
  }
  process.exit(exit);
}

main();
