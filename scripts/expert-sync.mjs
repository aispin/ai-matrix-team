#!/usr/bin/env node
/**
 * expert-sync.mjs — 成员真源（类）→ 专家包 全链同步工具
 *
 * 真源:  <team-repo>/members/<role>.md（五席，唯一允许修改的成员定义）
 * 实例:  专家团包 ai-matrix-team + 独立专家包 aimatrix-team-team-lead / aimatrix-team-product-designer
 *
 * 用法:
 *   node scripts/expert-sync.mjs            # 写入实例 + 官方 validate→register→package + cache 落位 + installed_plugins 对齐
 *   node scripts/expert-sync.mjs --check    # 只报告漂移不写入（退出码 1 = 有漂移）
 *
 * 纪律: 永远只改 members/ 真源 → 跑本脚本；禁止手改任何包内实例文件。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TEAM_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEMBERS = path.join(TEAM_REPO, 'members');
const AVATARS = path.join(TEAM_REPO, 'assets', 'avatars');
const HOME = os.homedir();
const MP = path.join(HOME, '.workbuddy/plugins/marketplaces/my-experts');
const PLUGINS = path.join(MP, 'plugins');
const CACHE = path.join(HOME, '.workbuddy/plugins/cache/my-experts');
const INSTALLED = path.join(HOME, '.workbuddy/plugins/installed_plugins.json');
const DIST = path.join(HOME, 'WorkBuddy/ISkills/expert-dist');
const EM_SCRIPTS = '/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/expert-manager/scripts';
const checkOnly = process.argv.includes('--check');
const LEGACY_KEYS = ['aimatrix-pm@my-experts', 'hugo@my-experts'];
const LEGACY_PLUGIN_NAMES = ['aimatrix-pm', 'hugo'];

// ---------------------------------------------------------------- 成员元数据（真源登记表）

const ROLES = [
  { file: 'team-lead.md', id: 'aimatrix-team-team-lead', avatar: 'team-lead.png', standalone: true,
    displayName: { en: 'PC', zh: 'PC' },
    profession: { en: 'AI-Matrix Delivery Director', zh: 'AIM产研高级总监' },
    soloDescription: 'AI-Matrix delivery director PC as a standalone expert: classifies intent into workflows, opens work orders, dispatches with machine gates, owns the DR ledger; also the gatekeeper for controlled surfaces.' },
  { file: 'product-designer.md', id: 'aimatrix-team-product-designer', avatar: 'product-designer.png', standalone: true,
    displayName: { en: 'Mao', zh: '毛毛' },
    profession: { en: 'AI-Matrix Senior Product Designer', zh: 'AIM资深产品设计师' },
    soloDescription: 'AI-Matrix senior product designer Mao as a standalone expert: BRD then PRD then interactive visual draft in one chain; requirements always carry observable acceptance criteria.' },
  { file: 'developer.md', id: 'aimatrix-team-developer', avatar: 'developer.png', standalone: false,
    displayName: { en: 'Bruce', zh: 'Bruce' },
    profession: { en: 'AI-Matrix Senior Development Engineer', zh: 'AIM资深研发工程师' } },
  { file: 'qa.md', id: 'aimatrix-team-qa', avatar: 'qa.png', standalone: false,
    displayName: { en: 'Xue', zh: '石头' },
    profession: { en: 'AI-Matrix Senior QA Engineer', zh: 'AIM资深质检工程师' } },
  { file: 'devops.md', id: 'aimatrix-team-devops', avatar: 'devops.png', standalone: false,
    displayName: { en: 'Bo', zh: '波波' },
    profession: { en: 'AI-Matrix Senior DevOps Engineer', zh: 'AIM资深运维工程师' } },
];

const TEAM_VERSION = '0.5.0';
const SOLO_VERSION = '0.1.0';

// ---------------------------------------------------------------- 工具

const renderFor = (srcText, agentName) =>
  srcText.replace(/^(name: ).*$/m, `$1${agentName}`);

function desiredFiles() {
  // 返回 Map<absPath, string|Buffer> 期望内容
  const out = new Map();
  for (const r of ROLES) {
    const src = fs.readFileSync(path.join(MEMBERS, r.file), 'utf8');
    out.set(path.join(PLUGINS, 'ai-matrix-team', 'agents', `${r.id}.md`), renderFor(src, r.id));
    if (r.standalone) {
      out.set(path.join(PLUGINS, r.id, 'agents', `${r.id}.md`), renderFor(src, r.id));
    }
  }
  // 团队包 plugin.json
  out.set(path.join(PLUGINS, 'ai-matrix-team', '.codebuddy-plugin', 'plugin.json'), JSON.stringify(teamPluginJson(), null, 2) + '\n');
  out.set(path.join(PLUGINS, 'ai-matrix-team', 'settings.json'), JSON.stringify({ agent: 'aimatrix-team-team-lead' }, null, 2) + '\n');
  out.set(path.join(PLUGINS, 'ai-matrix-team', 'manifest.yaml'), manifest('ai-matrix-team', TEAM_VERSION));
  // 独立包
  for (const r of ROLES.filter((x) => x.standalone)) {
    out.set(path.join(PLUGINS, r.id, '.codebuddy-plugin', 'plugin.json'), JSON.stringify(soloPluginJson(r), null, 2) + '\n');
    out.set(path.join(PLUGINS, r.id, 'settings.json'), JSON.stringify({ agent: r.id }, null, 2) + '\n');
    out.set(path.join(PLUGINS, r.id, 'manifest.yaml'), manifest(r.id, SOLO_VERSION));
  }
  return out;
}

function memberEntries() {
  return ROLES.map((r, i) => ({
    id: r.id,
    displayName: r.displayName,
    profession: r.profession,
    avatar: `avatars/${r.avatar}`,
    role: i === 0 ? 'lead' : 'member',
  }));
}

function teamPluginJson() {
  return {
    name: 'ai-matrix-team',
    version: TEAM_VERSION,
    description: 'Five-role software delivery team: product designer (BRD+PRD+visual draft in one chain), implementation with architecture quick-calls, independent QA/compliance audit, release; risk-control gatekeeping held by the lead PC.',
    author: { name: 'ZEO', email: '85879+aispin@users.noreply.github.com' },
    agents: ROLES.map((r) => `./agents/${r.id}.md`),
    expertType: 'team',
    agentName: 'aimatrix-team-team-lead',
    teamInfo: {
      leadAgent: 'aimatrix-team-team-lead',
      memberAgents: ROLES.slice(1).map((r) => r.id),
    },
    displayName: { en: 'AI-Matrix Delivery Team', zh: 'AI-Matrix 专家团' },
    profession: { en: 'AI-Matrix Delivery Team', zh: 'AI-Matrix 专家团' },
    displayDescription: {
      zh: '五席交付团：产品设计师 BRD→PRD→设计稿一条链、研发兼架构速断、质检独立审计、运维发布回滚；风控守门并入团长 PC。',
      en: 'Five-role crew: product designer (BRD→PRD→visual draft), developer with architecture quick-calls, independent QA, release; gatekeeping held by lead PC.',
    },
    avatar: 'avatars/team.png',
    categoryId: '02-Engineering',
    defaultInitPrompt: {
      zh: '我要接入一个新 App，走完整立项到上线流程',
      en: 'Onboard a new app — run the full pipeline from business case to release',
    },
    plugin: 'ai-matrix-team',
    tags: [
      { en: 'Shared Surface Governance', zh: '共享面治理' },
      { en: 'Multi-App Delivery', zh: '多 App 交付' },
      { en: 'Human-in-the-loop', zh: '人机决策' },
    ],
    quickPrompts: [
      { zh: '我要接入一个新 App，走完整立项到上线流程', en: 'Onboard a new app — run the full pipeline from business case to release' },
      { zh: '我要改 packages 下的共享模块，帮我走共享面变更流程', en: 'I need to change a shared package — run the shared-surface change workflow' },
      { zh: '帮我梳理现在有哪些待我拍板的决策项，再跑一次合规巡检', en: 'List decisions waiting for my call, then run a compliance sweep' },
    ],
    members: memberEntries(),
  };
}

function soloPluginJson(r) {
  const base = {
    name: r.id,
    version: SOLO_VERSION,
    description: r.soloDescription,
    agents: [`./agents/${r.id}.md`],
    expertType: 'agent',
    agentName: r.id,
    displayName: r.displayName,
    profession: r.profession,
    avatar: `avatars/${r.avatar}`,
    categoryId: '02-Engineering',
    author: { name: 'ZEO', email: '85879+aispin@users.noreply.github.com' },
    members: [
      { name: r.id, en: r.displayName.en, zh: r.displayName.zh, profession: r.profession },
    ],
  };
  if (r.id === 'aimatrix-team-team-lead') {
    base.displayDescription = {
      en: 'Delivery director of the AI-Matrix team: opens work orders, dispatches phase by phase with machine gates, and assembles auditable handoffs; gatekeeper for controlled surfaces.',
      zh: 'AI-Matrix 产研高级总监：开工作单、逐 Phase 派单带机器门禁、可审计交付；兼受控面守门。项目任务可用。',
    };
    base.defaultInitPrompt = { zh: '扫一下当前项目的合规状况，给出治理建议', en: 'Audit this project and suggest fixes' };
    base.tags = [
      { zh: '交付管理', en: 'Delivery' },
      { zh: 'AI-Matrix', en: 'AI-Matrix' },
      { zh: '工作流门禁', en: 'Workflow Gates' },
    ];
    base.quickPrompts = [
      { zh: '扫一下当前项目的合规状况，给出治理建议', en: 'Audit this project and suggest fixes' },
      { zh: '我有个新需求，判面域并开工单推进', en: 'Classify my requirement and open a work order' },
      { zh: '回顾最近的工单台账，汇总遗留风险', en: 'Review recent work orders and risks' },
    ];
  } else {
    base.displayDescription = {
      en: 'One chain: why it matters (BRD) → what & acceptance (PRD) → what it looks like (interactive draft); requirements always carry observable acceptance criteria',
      zh: '一条链：为什么值得做（BRD）→ 做什么与验收（PRD）→ 长什么样（可交互设计稿）；需求必带可观测验收标准。',
    };
    base.defaultInitPrompt = { zh: '我有个产品想法，帮我按 Working Backwards 写 BRD、PRD 和可交互设计稿。', en: 'I have a product idea; write a Working Backwards BRD, PRD and an interactive design draft.' };
    base.tags = [
      { zh: '产品设计', en: 'Product Design' },
      { zh: 'BRD PRD 设计稿', en: 'BRD PRD Design' },
      { zh: 'AI-Matrix', en: 'AI-Matrix' },
    ];
    base.quickPrompts = [
      { zh: '我有个产品想法，帮我按 Working Backwards 写 BRD、PRD 和可交互设计稿。', en: 'Write a Working Backwards BRD, PRD and interactive draft for my idea' },
      { zh: '评审这份需求清单，把不可验收的条目打回重写', en: 'Review these requirements and flag unverifiable ones' },
      { zh: '把这段口头需求整理成带验收标准的 PRD 条目', en: 'Turn this verbal requirement into PRD items with acceptance criteria' },
    ];
  }
  return base;
}

const manifest = (name, version) => `name: ${name}\nversion: "${version}"\ntype: expert\n`;

// ---------------------------------------------------------------- 动作

let drift = 0;
function writeFileSafe(p, content) {
  const cur = fs.existsSync(p) ? fs.readFileSync(p, p.endsWith('.png') ? null : 'utf8') : undefined;
  const same = cur !== undefined && (Buffer.isBuffer(content) ? cur.equals(content) : cur === content);
  if (same) return;
  drift++;
  if (!checkOnly) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    console.log(`  ✓ 写入 ${path.relative(PLUGINS, p)}`);
  } else {
    console.log(`  ✗ 漂移 ${path.relative(PLUGINS, p)}`);
  }
}

function copyAvatars() {
  const pairs = [
    ['team.png', 'ai-matrix-team/avatars/team.png'],
    ['team-lead.png', 'aimatrix-team-team-lead/avatars/team-lead.png'],
    ['product-designer.png', 'aimatrix-team-product-designer/avatars/product-designer.png'],
  ];
  // 团队包成员头像按角色 id 命名
  for (const r of ROLES) pairs.push([r.avatar, `ai-matrix-team/avatars/${r.id}.png`]);
  for (const [src, dst] of pairs) {
    const s = path.join(AVATARS, src);
    if (!fs.existsSync(s)) { console.error(`❌ 缺头像: ${s}`); process.exit(2); }
    writeFileSafe(path.join(PLUGINS, dst), fs.readFileSync(s));
  }
}

function runOfficial(pkgName) {
  const dir = path.join(PLUGINS, pkgName);
  const py = process.env.PYTHONPATH ? { ...process.env, PYTHONPATH: '' } : { ...process.env };
  const run = (script) => {
    console.log(`  ▸ ${script.split('/').pop()} ${pkgName}`);
    execFileSync('python3', [path.join(EM_SCRIPTS, script), dir], { env: py, stdio: 'inherit' });
  };
  run('validate_expert.py');
  run('register_expert.py');
  // package 到 expert-dist
  fs.mkdirSync(DIST, { recursive: true });
  console.log('  ▸ package_expert.py');
  execFileSync('python3', [path.join(EM_SCRIPTS, 'package_expert.py'), dir, DIST], { env: py, stdio: 'inherit' });
}

function cacheInstall(pkgName, version) {
  const dst = path.join(CACHE, pkgName, version);
  const src = path.join(PLUGINS, pkgName);
  if (!checkOnly) {
    fs.rmSync(dst, { recursive: true, force: true });
    fs.cpSync(src, dst, { recursive: true });
    console.log(`  ✓ cache 落位 ${pkgName}@${version}`);
  }
}

function syncInstalled() {
  if (checkOnly) return;
  const now = new Date().toISOString();
  const data = JSON.parse(fs.readFileSync(INSTALLED, 'utf8'));
  data.plugins = data.plugins || {};
  // 清理旧专家登记
  for (const k of LEGACY_KEYS) delete data.plugins[k];
  const set = (name, version) => {
    const key = `${name}@my-experts`;
    const prev = data.plugins[key]?.[0];
    data.plugins[key] = [{
      scope: 'user',
      installPath: path.join(CACHE, name, version),
      version,
      installedAt: prev?.installedAt || now,
      lastUpdated: now,
    }];
  };
  set('ai-matrix-team', TEAM_VERSION);
  for (const r of ROLES.filter((x) => x.standalone)) set(r.id, SOLO_VERSION);
  fs.writeFileSync(INSTALLED, JSON.stringify(data, null, 2) + '\n');
  console.log('✓ installed_plugins.json 已对齐（旧 aimatrix-pm/hugo 登记已清除）');
  // marketplace.json 清理旧条目（register_expert.py 已加新条目）
  const mkPath = path.join(MP, '.codebuddy-plugin', 'marketplace.json');
  if (fs.existsSync(mkPath)) {
    const mk = JSON.parse(fs.readFileSync(mkPath, 'utf8'));
    if (Array.isArray(mk.plugins)) {
      const before = mk.plugins.length;
      mk.plugins = mk.plugins.filter((p) => !LEGACY_PLUGIN_NAMES.includes(p.name));
      fs.writeFileSync(mkPath, JSON.stringify(mk, null, 2) + '\n');
      if (mk.plugins.length !== before) console.log('✓ marketplace.json 旧条目已清除');
    }
  }
}

// ---------------------------------------------------------------- main

console.log(checkOnly ? '== expert-sync CHECK ==' : '== expert-sync SYNC ==');
const desired = desiredFiles();
writeFileSafe;
for (const [p, content] of desired) {
  const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined;
  if (cur !== content) {
    drift++;
    if (checkOnly) console.log(`  ✗ 漂移 ${path.relative(PLUGINS, p)}`);
  }
}
copyAvatars();
if (checkOnly) {
  console.log(drift === 0 ? 'CHECK OK：全部实例与真源一致' : `CHECK DRIFT：${drift} 处漂移`);
  process.exit(drift === 0 ? 0 : 1);
}
// 写入模式：重写全部期望文件
for (const [p, content] of desired) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
drift = 0; // 已写入
console.log(`✓ 实例已按真源重写（团队包 + ${ROLES.filter((r) => r.standalone).length} 独立包）`);

runOfficial('ai-matrix-team');
for (const r of ROLES.filter((x) => x.standalone)) runOfficial(r.id);
cacheInstall('ai-matrix-team', TEAM_VERSION);
for (const r of ROLES.filter((x) => x.standalone)) cacheInstall(r.id, SOLO_VERSION);
syncInstalled();
console.log('SYNC DONE：validate→register→package→cache→installed 全链完成。重开会话生效。');
