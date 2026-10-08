#!/usr/bin/env node
/**
 * install-to-workbuddy.mjs · AI Matrix Team Skill 软链安装器
 *
 * 真源：<team-repo>/aimatrix-<role>/      （团队独立仓，唯一真相源）
 * 激活：<repo>/.workbuddy/skills/aimatrix-<role>/（不入库，软链，WorkBuddy 在此扫描项目级 Skill）
 *
 * 为什么必须软链而不是复制：真相源要跟着 git 走（可 review / 可回滚 / 可被 CI 读）；
 * 而 WorkBuddy 只认 .workbuddy/skills/ 这一处项目级位置，且该目录被 .gitignore 排除。
 * 复制 = 两份副本漂移（本项目 Charter P2 明令禁止）。
 *
 * 用法：
 *   node <team-repo>/scripts/install-to-workbuddy.mjs              # 建链（幂等，重复跑安全）
 *   node <team-repo>/scripts/install-to-workbuddy.mjs --check      # 只校验不改动（CI / 巡检用）
 *   node <team-repo>/scripts/install-to-workbuddy.mjs --status     # 打印当前链接状态
 *   node <team-repo>/scripts/install-to-workbuddy.mjs --uninstall  # 只删自己建的链（不碰别的东西）
 *   node <team-repo>/scripts/install-to-workbuddy.mjs --user-level # 额外链到 ~/.workbuddy/skills/（谨慎）
 *   node <team-repo>/scripts/install-to-workbuddy.mjs --force      # 冲突时把旧物改名为 .bak-<ts> 后重建
 *   node <team-repo>/scripts/install-to-workbuddy.mjs --json       # 机器可读输出
 *   node <team-repo>/scripts/install-to-workbuddy.mjs --project <dir> # 指定目标项目根
 *
 * 退出码：0 全部就绪 · 1 有缺失/漂移 · 2 有冲突且未处理 · 3 用法错误
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_PREFIX = 'aimatrix-';

// ---------------------------------------------------------------- 参数

function parseArgs(argv) {
  const args = {
    mode: 'install',
    userLevel: false,
    force: false,
    json: false,
    root: null
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--check': args.mode = 'check'; break;
      case '--status': args.mode = 'status'; break;
      case '--uninstall': args.mode = 'uninstall'; break;
      case '--install': args.mode = 'install'; break;
      case '--user-level': args.userLevel = true; break;
      case '--force': args.force = true; break;
      case '--json': args.json = true; break;
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

const TEAM_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // Skill 真源根（本仓）

function discoverSkills(root) {
  const skillsDir = root; // 团队仓根即 Skill 真源根
  if (!exists(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .filter((e) => e.name.startsWith(SKILL_PREFIX))
    .map((e) => path.join(skillsDir, e.name))
    .filter((dir) => exists(path.join(dir, 'SKILL.md')))
    .sort();
}

function readLinkTarget(linkPath) {
  try { return fs.readlinkSync(linkPath); } catch { return null; }
}

function targetsFor(skillDir, args) {
  const name = path.basename(skillDir);
  const root = args.targetProvided;
  const list = [{ kind: 'project', dir: path.join(root, '.workbuddy', 'skills'), name }];
  if (args.userLevel) {
    list.push({ kind: 'user', dir: path.join(os.homedir(), '.workbuddy', 'skills'), name });
  }
  return list;
}

function relTarget(fromDir, toPath) {
  return path.relative(fromDir, toPath);
}

function makeBackup(p) {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const bak = `${p}.bak-${ts}`;
  fs.renameSync(p, bak);
  return bak;
}

// ---------------------------------------------------------------- 核心

function inspectAll(root, args) {
  const skills = discoverSkills(root);
  const records = [];
  for (const skillDir of skills) {
    for (const t of targetsFor(skillDir, args)) {
      const linkPath = path.join(t.dir, t.name);
      const rec = { skill: path.basename(skillDir), kind: t.kind, link: linkPath, state: null, detail: '', bak: null };
      const wantRel = relTarget(t.dir, skillDir);
      if (!exists(linkPath)) {
        rec.state = 'missing';
      } else {
        const st = fs.lstatSync(linkPath);
        if (!st.isSymbolicLink()) {
          rec.state = 'conflict';
          rec.detail = '已存在同名的真实文件/目录（不是我们建的软链）';
        } else {
          const actual = readLinkTarget(linkPath);
          const resolved = path.resolve(t.dir, actual);
          if (resolved !== path.resolve(skillDir)) {
            rec.state = 'conflict';
            rec.detail = `软链指向别处：${actual}`;
          } else if (!exists(path.join(resolved, 'SKILL.md'))) {
            rec.state = 'dangling';
            rec.detail = `链接可达但目标无 SKILL.md：${resolved}`;
          } else if (path.isAbsolute(actual)) {
            rec.state = 'ok-abs';
            rec.detail = `用的是绝对路径，仓库一旦搬家就断：${actual}`;
          } else {
            rec.state = 'ok';
            rec.detail = `→ ${actual}`;
          }
        }
      }
      rec.wantRel = wantRel;
      records.push(rec);
    }
  }
  return { skills, records };
}

function install(args, io) {
  const { skills, records } = inspectAll(args.rootProvided, args);
  if (skills.length === 0) {
    io.warn(`未在 ${args.rootProvided} 下发现任何含 SKILL.md 的 ${SKILL_PREFIX}* 目录`);
    io.warn('这是正常的——Skill 内容尚未编写（见 docs/06-rollout.md）。建链将在 Skill 落地后生效。');
  }
  let changed = 0;
  let conflicts = 0;
  for (const rec of records) {
    if (rec.state === 'ok' || rec.state === 'ok-abs') continue;
    if (rec.state === 'conflict') {
      if (!args.force) { conflicts++; continue; }
      rec.bak = makeBackup(rec.link);
      io.line(`  ! ${rec.skill}（${rec.kind}）冲突已备份 → ${path.basename(rec.bak)}`);
    }
    fs.mkdirSync(path.dirname(rec.link), { recursive: true });
    if (exists(rec.link)) fs.unlinkSync(rec.link);
    fs.symlinkSync(rec.wantRel, rec.link, 'dir');
    changed++;
    io.line(`  + ${rec.skill} → ${rec.kind === 'project' ? '.workbuddy/skills' : '~/.workbuddy/skills'}/${rec.skill}`);
  }
  return { skills, records, changed, conflicts };
}

function uninstall(args, io) {
  const { records } = inspectAll(args.rootProvided, args);
  let removed = 0;
  for (const rec of records) {
    const actual = readLinkTarget(rec.link);
    if (!actual) continue;
    const resolved = path.resolve(path.dirname(rec.link), actual);
    // 只删指向团队仓真源的链，绝不误删别人的东西
    if (!resolved.startsWith(TEAM_ROOT)) continue;
    fs.unlinkSync(rec.link);
    removed++;
    io.line(`  - ${rec.skill}（${rec.kind}）`);
  }
  return { records, removed };
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

function summarize(records) {
  const counts = { ok: 0, 'ok-abs': 0, missing: 0, conflict: 0, dangling: 0 };
  for (const r of records) counts[r.state] = (counts[r.state] ?? 0) + 1;
  return counts;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`参数错误：${e.message}`);
    process.exit(3);
  }

  const sourceRoot = TEAM_ROOT;
  const targetProvided = args.project ? path.resolve(args.project)
    : fs.existsSync(path.join(process.cwd(), '.workbuddy')) ? process.cwd() : process.cwd();
  args.rootProvided = sourceRoot;
  args.targetProvided = targetProvided;
  const io = createIo(args.json);

  if (args.mode === 'help') {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').trim());
    process.exit(0);
  }

  io.line(`AI Matrix Skill 软链安装器 · 真源根：${sourceRoot} · 目标项目：${targetProvided}`);
  io.line(`模式：${args.mode}${args.userLevel ? ' · 含用户级' : ''}${args.force ? ' · --force' : ''}`);
  io.line('');

  let exit = 0;
  let payload = {};

  if (args.mode === 'install') {
    const r = install(args, io);
    payload = { skills: r.skills.length, changed: r.changed, conflicts: r.conflicts };
    io.line('');
    io.line(`技能 ${r.skills.length} 个 · 新键/修复 ${r.changed} 处 · 未处理冲突 ${r.conflicts} 处`);
    if (r.conflicts > 0) {
      io.warn('有同名旧物挡路。确认可弃再加 --force（会被改名备份，不会直接删除）。');
      exit = 2;
    }
  } else if (args.mode === 'check' || args.mode === 'status') {
    const { skills, records } = inspectAll(sourceRoot, args);
    const c = summarize(records);
    payload = { skills: skills.length, counts: c };
    io.line(`技能 ${skills.length} 个 · 链接 ${records.length} 条`);
    io.line(`  就绪 ${c.ok + c['ok-abs']} · 缺失 ${c.missing} · 悬空 ${c.dangling} · 冲突 ${c.conflict}`);
    for (const r of records) {
      if (r.state === 'ok') continue;
      io.line(`  ! [${r.state}] ${r.skill}（${r.kind}）${r.detail ? ' — ' + r.detail : ''}`);
    }
    if (args.mode === 'check' && (c.missing + c.dangling + c.conflict > 0)) exit = 1;
    if (args.mode === 'check' && c['ok-abs'] > 0) {
      io.warn('有链接用了绝对路径或跨级相对路径，建议重建为同级相对链（rerun install 会自动修正为相对）。');
    }
  } else if (args.mode === 'uninstall') {
    const r = uninstall(args, io);
    payload = { removed: r.removed };
    io.line('');
    io.line(`已移除 ${r.removed} 条链（真相源团队仓未被触动）`);
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
