#!/usr/bin/env node
/**
 * aimatrix-init.mjs — 专家团「首次引导」扫描器
 *
 * 用途：专家团接入一个新项目时，扫描项目目录结构，分析后落
 * `<project>/.ai-matrix-team/project.json`（项目档案）。此后 guard / 巡检 / dashboard /
 * 各角色 Agent 均以该文件为初始化依据，实现专家团与具体项目解耦。
 *
 * 用法：
 *   node <team-repo>/scripts/aimatrix-init.mjs [--root <repo>] [--force] [--check]
 *
 * 退出码：0 成功 / 1 --check 漂移 / 2 参数错误
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
const FORCE = argv.includes('--force');
const CHECK = argv.includes('--check');
const CONFIG = path.join(ROOT, '.ai-matrix-team', 'project.json');



/* ---------- 探测工具 ---------- */
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const isDir = (p) => exists(p) && fs.statSync(path.join(ROOT, p)).isDirectory();
const listDirs = (p) => (isDir(p) ? fs.readdirSync(path.join(ROOT, p), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name) : []);
const listFiles = (p) => (isDir(p) ? fs.readdirSync(path.join(ROOT, p), { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name) : []);
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return null; } };

function gitRemote() {
  try {
    return execFileSync('git', ['-C', ROOT, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  } catch { return null; }
}

/** 探测前端技术栈（汇总 apps/* 的关键依赖版本） */
function detectStack() {
  const stack = new Map();
  const pkgDirs = [...listDirs('apps'), ...listDirs('services'), ...listDirs('packages')];
  const roots = ['apps', 'services', 'packages'];
  for (const base of roots) {
    for (const d of listDirs(base)) {
      const pkg = readJson(path.join(base, d, 'package.json'));
      if (!pkg) continue;
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const key of ['vite', 'react', 'vue', 'tailwindcss', 'typescript', 'next', 'electron', 'hono', 'express', 'fastify']) {
        if (deps[key]) {
          const cur = stack.get(key);
          if (!cur || cur.list.length < 20) {
            stack.set(key, { version: deps[key].replace(/^[\^~]/, ''), list: [...(cur?.list || []), `${base}/${d}`] });
          }
        }
      }
    }
  }
  return Object.fromEntries([...stack.entries()].map(([k, v]) => [k, { version: v.version, usedBy: v.list }]));
}

/* ---------- 组装项目档案 ---------- */
function buildProfile() {
  const pkg = readJson('package.json') || {};
  const wsYaml = exists('pnpm-workspace.yaml') ? fs.readFileSync(path.join(ROOT, 'pnpm-workspace.yaml'), 'utf8') : '';
  const globs = [...wsYaml.matchAll(/-\s*['"]?([^\s'"]+)['"]?/g)].map((m) => m[1]).filter((g) => g.includes('*'));

  const apps = listDirs('apps');
  const pkgs = listDirs('packages');
  const svcs = listDirs('services');
  const docsMd = listFiles('docs').filter((f) => f.endsWith('.md'));

  // 规范文档绑定：按约定文件名匹配，找不到就 null（各角色 Skill 需容忍缺失）
  const pickDoc = (re) => docsMd.find((f) => re.test(f)) || null;
  const docs = {
    brd: pickDoc(/^brd/i),
    prdStandard: pickDoc(/^(architecture|prd)/i),
    sharedContracts: pickDoc(/shared-contracts/i),
    appOnboarding: pickDoc(/app-onboarding|onboarding/i),
    deploy: pickDoc(/^deploy/i),
    all: docsMd,
  };

  const ciWorkflows = isDir('.github/workflows') ? listFiles('.github/workflows').filter((f) => /\.(yml|yaml)$/.test(f)) : [];

  // 面域初判（新项目冷启动默认值；init 后由人/资深架构师校正）
  const surfaces = {
    C1: [...pkgs.map((p) => `packages/${p}/**`), ...svcs.map((s) => `services/${s}/**`), '.github/**', 'pnpm-workspace.yaml', 'tsconfig*.json', 'package.json'],
    C2: ['scripts/**', 'infra/**', 'docs/**'],
    C3: ['apps/*/matrix.config.json', 'apps/*/.env.example', 'apps/*/docs/**'],
    F: ['apps/*/src/**', 'apps/*/public/**', 'apps/*/scripts/**', 'apps/*/packages/*/src/**'],
    T: ['.ai-matrix-team/runtime/**'],
  };

  return {
    generatedAt: new Date().toISOString(),
    generator: 'aimatrix-init.mjs v1',
    project: {
      name: pkg.name || path.basename(ROOT),
      description: pkg.description || '',
      repoRemote: gitRemote(),
      packageManager: (pkg.packageManager || 'pnpm').split('@')[0],
    },
    workspace: { globs, apps, packages: pkgs, services: svcs },
    stack: detectStack(),
    docs,
    ci: { workflows: ciWorkflows },
    surfaces,
    team: {
      name: 'ai-matrix-team',
      repo: TEAM_ROOT,
      home: '.ai-matrix-team',
      gateRules: '.ai-matrix-team/surfaces.json', // 已有 surfaces.json 的项目沿用；新项目由本档案 surfaces 段生成
      docsDir: 'docs',
      runtimeDir: '.ai-matrix-team/runtime',
    },
    terms: {
      // 大白话术语表：dashboard 与汇报模式使用；可按项目自定义
      wo: { label: '工单', desc: '一张有编号的任务单，写清改哪里、怎么验证、怎么回滚' },
      dr: { label: '待拍板', desc: '只有老板能定的事，定不下来就不继续' },
      lock: { label: '占用', desc: '公共区域正在有人施工，其他人排队' },
      c1: { label: '核心区', desc: '多个产品共用的代码，改动要审批' },
      c2: { label: '公共区', desc: '脚本、文档等公共资产，改动要登记' },
      f: { label: '自由区', desc: '各产品自己的地盘，直接改' },
      wo_closed: { label: '已完工单', desc: '干完并验收过的任务' },
    },
  };
}

/* ---------- 主流程 ---------- */
const profile = buildProfile();
const serialized = JSON.stringify(profile, null, 2) + '\n';

if (CHECK) {
  if (!fs.existsSync(CONFIG)) {
    console.error(`❌ ${path.relative(ROOT, CONFIG)} 不存在 —— 请先跑 init（不带 --check）`);
    process.exit(1);
  }
  const cur = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const stale = cur.generatedAt !== profile.generatedAt;
  // 结构性漂移：apps/services/packages 清单或规范文档变化
  const a = JSON.stringify({ w: profile.workspace, d: profile.docs, c: profile.ci.workflows });
  const b = JSON.stringify({ w: cur.workspace, d: cur.docs, c: cur.ci?.workflows });
  if (a !== b) {
    console.error('⚠️ config.json 与项目现状漂移（workspace/docs/CI 变化）—— 重跑 init 刷新');
    process.exit(1);
  }
  if (stale && !FORCE) {
    console.log('ℹ️ 仅时间戳差异（结构一致），视为新鲜。');
  }
  console.log('✅ config.json 与项目现状一致');
  process.exit(0);
}

if (fs.existsSync(CONFIG) && !FORCE) {
  console.error(`⚠️ ${path.relative(ROOT, CONFIG)} 已存在。确认要重新扫描请加 --force（人工已校正的内容会被覆盖，请先 diff）。`);
  process.exit(2);
}

fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
fs.writeFileSync(CONFIG, serialized);
console.log(`✅ 项目档案已落盘：${path.relative(ROOT, CONFIG)}`);
console.log(`   项目：${profile.project.name}（apps: ${profile.workspace.apps.length} · packages: ${profile.workspace.packages.length} · services: ${profile.workspace.services.length}）`);
console.log(`   规范文档绑定：${Object.entries(profile.docs).filter(([k, v]) => k !== 'all' && v).map(([k, v]) => `${k}=${v}`).join(' · ') || '（未发现约定命名的规范文档，请人工补 profile.docs）'}`);
console.log('   下一步：人工核对 surfaces 初判 → 校正 terms 术语 → 各角色 Agent 以本档案初始化。');
