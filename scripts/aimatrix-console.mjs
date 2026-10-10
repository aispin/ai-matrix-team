#!/usr/bin/env node
/**
 * aimatrix-console.mjs — 一条命令打开/重启团队操盘台（dashboard）。
 *
 * 解决：改了服务端代码或 about.json 后必须重启才生效；手动 kill + 起进程容易漏、且端口被占时不知道实际落在哪个端口。
 *
 * 用法：
 *   node <team-repo>/scripts/aimatrix-console.mjs [--project <root>] [--port 4780] [--keep] [--no-report]
 *     --project   目标项目根（默认 cwd）；台账与档案取自它
 *     --port      首选端口（默认 4780；被占用时服务端自动 +1，本脚本会打印实际端口）
 *     --keep      已在运行就不重启（默认行为=重启，以便拾取新代码/新数据）
 *     --no-report 跳过生成汇报（只保证服务在跑）
 *
 * 退出码：0 服务可用；1 启动失败。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';

const TEAM_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const getArg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const has = (n) => argv.includes(n);
const log = (s) => console.log(s);

const PROJECT = path.resolve(getArg('--project') || process.env.AIM_PROJECT_ROOT || process.cwd());
const PORT = Number(getArg('--port') || 4780);
const SERVER = path.join(TEAM_REPO, 'dashboard', 'server', 'server.mjs');
const slug = () => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(PROJECT, '.ai-matrix-team', 'project.json'), 'utf8'));
    return String(j.project?.name || path.basename(PROJECT)).replace(/[^\w.-]+/g, '-');
  } catch { return path.basename(PROJECT); }
};

// ---------- 前置校验 ----------
if (!fs.existsSync(path.join(PROJECT, '.ai-matrix-team', 'project.json'))) {
  console.error(`✗ 不是 ai-matrix-team 项目（缺 .ai-matrix-team/project.json）：${PROJECT}`);
  console.error('  先跑：node <team-repo>/scripts/aimatrix-init.mjs --project ' + PROJECT);
  process.exit(1);
}

// ---------- ① 生成汇报（可跳过） ----------
if (!has('--no-report')) {
  const r = spawnSync(process.execPath, [path.join(TEAM_REPO, 'scripts', 'aimatrix-report.mjs'), '--root', PROJECT], {
    encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' },
  });
  const line = (r.stdout || '').split('\n').filter((l) => l.includes('已入库')).pop();
  log(line ? `✓ 汇报已更新：${line.replace(/^.*?📦\s*/, '').trim()}` : '（汇报生成未输出，继续起服务）');
  if (r.status !== 0 && r.stderr) log(`  提示：${(r.stderr.split('\n')[0] || '').slice(0, 120)}`);
}

// ---------- ② 找到并处理已有实例 ----------
// 主用「实例状态文件」（registry）：沙箱里 ps 常被禁、lsof 也可能不可用，argv/cwd 探测都不可靠。
const DATA_DIR = path.join(TEAM_REPO, 'dashboard', 'data');
const stateFile = () => path.join(DATA_DIR, `console-${slug()}.json`);
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return null; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// 兜底：老实例（本次改造前启动的）没有状态文件 → 用 pgrep + lsof cwd 尽力识别
const legacyCandidates = () => {
  const ps = spawnSync('pgrep', ['-f', 'dashboard/server/server.mjs'], { encoding: 'utf8' });
  const pids = (ps.stdout || '').split('\n').map((s) => s.trim()).filter((s) => s && Number(s) !== process.pid);
  const out = [];
  for (const pid of pids) {
    try {
      const l = spawnSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).stdout || '';
      const cwd = (l.split('\n').find((x) => x.startsWith('n')) || '').slice(1);
      if (cwd && path.resolve(cwd) === PROJECT) out.push(Number(pid));
    } catch { /* 探测不到就跳过 */ }
  }
  return out;
};

const probe = (port) => new Promise((resolve) => {
  const s = createConnection({ host: '127.0.0.1', port });
  s.on('connect', () => { s.destroy(); resolve(true); });
  s.on('timeout', () => { s.destroy(); resolve(false); });
  s.on('error', () => resolve(false));
  s.setTimeout(600);
});

const waitPortFree = async (port, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (!(await probe(port))) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return !(await probe(port));
};

const st = readState();
const running = st && alive(st.pid) && (await probe(st.port)) ? [st.pid] : [];
if (!running.length) running.push(...legacyCandidates());

if (running.length) {
  if (has('--keep')) {
    log(`✓ 控制台已在运行（PID ${running.join(', ')} · ${st?.port ? `http://127.0.0.1:${st.port}` : '端口见状态文件'}）`);
    if (st?.port) log(`  项目：${st.project}`);
    process.exit(0);
  }
  log(`↻ 重启控制台（停旧实例 PID ${running.join(', ')}，以拾取最新代码与数据）`);
  const oldPort = st?.port || PORT;
  for (const pid of running) { try { process.kill(pid, 'SIGTERM'); } catch { /* 已退出 */ } }
  if (!(await waitPortFree(oldPort, 4000))) {
    for (const pid of running) { try { process.kill(pid, 'SIGKILL'); } catch { /* 忽略 */ } }
    await waitPortFree(oldPort, 2000);
  }
  try { fs.rmSync(stateFile(), { force: true }); } catch { /* 忽略 */ }
}

// ---------- ③ 起服务（分离进程 + 日志落盘） ----------
const logPath = path.join(TEAM_REPO, 'dashboard', 'data', `serve-${slug()}.log`);
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, '');
const out = fs.openSync(logPath, 'a');
const child = spawn(process.execPath, [SERVER, '--project', PROJECT, '--port', String(PORT)], {
  detached: true, stdio: ['ignore', out, out], cwd: PROJECT, env: { ...process.env, NODE_OPTIONS: '' },
});
child.unref();

// 从日志里读实际端口（端口被外来进程占用时服务端会自动 +1）
let url = null;
const t0 = Date.now();
while (Date.now() - t0 < 8000) {
  const txt = fs.readFileSync(logPath, 'utf8');
  const m = txt.match(/OK\s+(http:\/\/127\.0\.0\.1:(\d+))/);
  if (m) { url = m[1]; break; }
  if (/✗ 启动失败/.test(txt)) { console.error(txt.trim()); process.exit(1); }
  await new Promise((r) => setTimeout(r, 200));
}

if (!url) {
  console.error(`✗ 服务未在 8s 内就绪，日志：${logPath}`);
  console.error(fs.readFileSync(logPath, 'utf8').split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}

const ok = await probe(Number(url.split(':').pop()));
// 记状态文件：下次启动据此精确停旧实例（不依赖 ps/lsof）
try {
  fs.writeFileSync(stateFile(), JSON.stringify({
    pid: child.pid, port: Number(url.split(':').pop()), project: PROJECT,
    startedAt: new Date().toISOString(), log: path.relative(TEAM_REPO, logPath),
  }, null, 2) + '\n');
} catch { /* 写不了不影响使用 */ }
log(`${ok ? '✓' : '✗'} 控制台：${url}`);
log(`  项目：${PROJECT}`);
log(`  台账：${path.join(PROJECT, '.ai-matrix-team', 'runtime')}`);
log(`  日志：${path.relative(TEAM_REPO, logPath)}`);
log('  首页=管线看板 · 汇报页=最新已置顶 · 关于=团队');
process.exit(ok ? 0 : 1);
