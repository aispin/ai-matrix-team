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

// 引擎版本：单一版本源 = 团队仓根 VERSION 文件（init 档案戳记、preflight 同源读取）
const TEAM_VERSION = fs.readFileSync(path.join(TEAM_REPO, 'VERSION'), 'utf8').trim() || '0.5.0';
const SOLO_VERSION = '0.1.0';

// ---------------------------------------------------------------- 共享文案（plugin.json 与 README 同源）

// 团队包开场提示语：同时用于 plugin.json 的 quickPrompts 与 README 的「怎么用」，避免两处漂移
const TEAM_QUICK_PROMPTS = [
  { zh: '我要接入一个新 App，走完整立项到上线流程', en: 'Onboard a new app — run the full pipeline from business case to release' },
  { zh: '我要改 packages 下的共享模块，帮我走共享面变更流程', en: 'I need to change a shared package — run the shared-surface change workflow' },
  { zh: '帮我梳理现在有哪些待我拍板的决策项，再跑一次合规巡检', en: 'List decisions waiting for my call, then run a compliance sweep' },
];

// 独立包开场提示语（键为角色 id）：同上，plugin.json 与 README 同源
const SOLO_QUICK_PROMPTS = {
  'aimatrix-team-team-lead': [
    { zh: '扫一下当前项目的合规状况，给出治理建议', en: 'Audit this project and suggest fixes' },
    { zh: '我有个新需求，判面域并开工单推进', en: 'Classify my requirement and open a work order' },
    { zh: '回顾最近的工单台账，汇总遗留风险', en: 'Review recent work orders and risks' },
  ],
  'aimatrix-team-product-designer': [
    { zh: '我有个产品想法，帮我按 Working Backwards 写 BRD、PRD 和可交互设计稿。', en: 'Write a Working Backwards BRD, PRD and interactive draft for my idea' },
    { zh: '评审这份需求清单，把不可验收的条目打回重写', en: 'Review these requirements and flag unverifiable ones' },
    { zh: '把这段口头需求整理成带验收标准的 PRD 条目', en: 'Turn this verbal requirement into PRD items with acceptance criteria' },
  ],
};

// 五席一句话职责（README 专用；缩写首次出现附中文释义，章程 T4）
const ROLE_DUTY = {
  'team-lead.md': '判面域、开工单（WO，Work Order，工作单）、逐阶段派单带机器门禁；兼受控面守门与决策台账（DR，Decision Record，决策记录）',
  'product-designer.md': '一条链：商业需求文档（BRD，Business Requirements Document）→ 产品需求文档（PRD，Product Requirements Document）→ 可交互设计稿',
  'developer.md': '按图施工：架构速断、写码、补单测；白名单外面域一律先问不先改',
  'qa.md': '独立审计：类型检查、测试与验收标准（AC，Acceptance Criteria）逐条核，不给门禁豁免',
  'devops.md': '发布与回滚：流水线、环境与灰度，出事能回滚',
};

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
  out.set(path.join(PLUGINS, 'ai-matrix-team', 'README.md'), teamReadme());
  // 独立包
  for (const r of ROLES.filter((x) => x.standalone)) {
    out.set(path.join(PLUGINS, r.id, '.codebuddy-plugin', 'plugin.json'), JSON.stringify(soloPluginJson(r), null, 2) + '\n');
    out.set(path.join(PLUGINS, r.id, 'settings.json'), JSON.stringify({ agent: r.id }, null, 2) + '\n');
    out.set(path.join(PLUGINS, r.id, 'manifest.yaml'), manifest(r.id, SOLO_VERSION));
    out.set(path.join(PLUGINS, r.id, 'README.md'), soloReadme(r));
  }
  return out;
}

// ---------------------------------------------------------------- README（校验器建议项：README.md is recommended）

/** 团队包 README：团队是什么 + 五席谁干什么 + 怎么用 */
function teamReadme() {
  const rows = ROLES.map((r) =>
    `| ${r.displayName.zh} | ${r.profession.zh} | ${ROLE_DUTY[r.file]} |`).join('\n');
  const prompts = TEAM_QUICK_PROMPTS.map((q) => `- ${q.zh}`).join('\n');
  return `# AI-Matrix 专家团

AI-Matrix 专家团是一支五席软件交付团：从立项到上线全链覆盖，每个阶段带机器门禁与可审计交接单，人来拍板、机器来守门。

## 五席分工

| 代号 | 职务 | 负责什么 |
|---|---|---|
${rows}

## 怎么用

在 WorkBuddy 专家中心选择「AI-Matrix 专家团」，用下面任意一句开场即可：

${prompts}

## 真源纪律

成员定义的唯一真源是本仓库 \`members/*.md\`（五席成员定义）；专家包内实例一律由
\`scripts/expert-sync.mjs\`（专家包同步脚本）生成，**禁止手改实例**，改真源后重跑脚本即可。
`;
}

/** 独立包 README：这席是谁 + 负责什么 + 怎么用 */
function soloReadme(r) {
  const prompts = (SOLO_QUICK_PROMPTS[r.id] || []).map((q) => `- ${q.zh}`).join('\n');
  return `# ${r.displayName.zh} · ${r.profession.zh}

${r.soloDescription}

## 负责什么

${ROLE_DUTY[r.file]}

## 怎么用

在 WorkBuddy 专家中心选择「${r.displayName.zh}」，用下面任意一句开场即可：

${prompts}

## 真源纪律

本席定义的唯一真源是本仓库 \`members/${r.file}\`（成员定义）；专家包内实例一律由
\`scripts/expert-sync.mjs\`（专家包同步脚本）生成，**禁止手改实例**，改真源后重跑脚本即可。
`;
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
      // 校验器建议 40–50 字符（实测 48），保留「五席」与「风控守门并入团长 PC」两个关键信息点；
      // 章程 T4：中文文案不裸用 BRD/PRD，改写为「需求文档→产品文档」（en 版沿用 BRD→PRD）
      zh: '五席交付团：需求文档→产品文档→设计稿一条链，研发、质检、运维各守一关；风控守门并入团长 PC。',
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
    quickPrompts: TEAM_QUICK_PROMPTS,
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
      // 校验器建议 40–50 字符：去掉「项目任务可用」冗余后缀
      zh: 'AI-Matrix 产研高级总监：开工作单、逐阶段派单带机器门禁、可审计交付；兼受控面守门。',
    };
    base.defaultInitPrompt = { zh: '扫一下当前项目的合规状况，给出治理建议', en: 'Audit this project and suggest fixes' };
    base.tags = [
      { zh: '交付管理', en: 'Delivery' },
      { zh: 'AI-Matrix', en: 'AI-Matrix' },
      { zh: '工作流门禁', en: 'Workflow Gates' },
    ];
    base.quickPrompts = SOLO_QUICK_PROMPTS['aimatrix-team-team-lead'];
  } else {
    base.displayDescription = {
      en: 'One chain: why it matters (BRD) → what & acceptance (PRD) → what it looks like (interactive draft); requirements always carry observable acceptance criteria',
      // 校验器建议 40–50 字符（实测 50）：「可观测验收标准」缩为「验收」
      zh: '一条链：为什么值得做（BRD）→ 做什么与验收（PRD）→ 长什么样（可交互设计稿）；需求必带验收。',
    };
    base.defaultInitPrompt = { zh: '我有个产品想法，帮我按 Working Backwards 写 BRD、PRD 和可交互设计稿。', en: 'I have a product idea; write a Working Backwards BRD, PRD and an interactive design draft.' };
    base.tags = [
      { zh: '产品设计', en: 'Product Design' },
      { zh: 'BRD PRD 设计稿', en: 'BRD PRD Design' },
      { zh: 'AI-Matrix', en: 'AI-Matrix' },
    ];
    base.quickPrompts = SOLO_QUICK_PROMPTS['aimatrix-team-product-designer'];
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

/**
 * 当前编制的期望产物清单（按包 × 子目录）
 * 返回 Map<包名, Map<子目录名, Set<应保留文件名>>>——清理逻辑的唯一判定依据。
 */
function expectedAssets() {
  const out = new Map();
  // 团队包：五席 agent 定义 + 团队头像 team.png + 五席成员头像（与 memberEntries() 同一口径）
  out.set('ai-matrix-team', new Map([
    ['agents', new Set(ROLES.map((r) => `${r.id}.md`))],
    ['avatars', new Set(['team.png', ...ROLES.map((r) => r.avatar)])],
  ]));
  // 独立包：本席 agent 定义 + 本席头像
  for (const r of ROLES.filter((x) => x.standalone)) {
    out.set(r.id, new Map([
      ['agents', new Set([`${r.id}.md`])],
      ['avatars', new Set([r.avatar])],
    ]));
  }
  return out;
}

// 各子目录允许清理的产物后缀——只认这两类产物，占位文件（如 .gitkeep）与其他杂项永不触碰
const PRUNABLE_EXT = { agents: ['.md'], avatars: ['.png', '.jpg', '.jpeg', '.webp', '.svg'] };

/**
 * 清理旧编制残留：删除不属于当前 ROLES 期望产物的旧文件（幂等，跑几次结果一致）。
 * 三重保险：① 只扫 PLUGINS 下本脚本管辖的三个包 ② 只删 agents/ 与 avatars/ 内的普通文件
 * ③ 后缀必须在 PRUNABLE_EXT 白名单内。真源 assets/avatars/ 不在此路径下，永不被触碰。
 */
function pruneStale() {
  for (const [pkg, dirs] of expectedAssets()) {
    for (const [sub, keep] of dirs) {
      const dir = path.join(PLUGINS, pkg, sub);
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir).sort()) {
        if (keep.has(name)) continue;
        // 后缀不在白名单内（含 .gitkeep 之类无后缀占位文件）→ 跳过
        if (!PRUNABLE_EXT[sub].includes(path.extname(name))) continue;
        const p = path.join(dir, name);
        // 保险：越出管辖目录或非普通文件一律跳过，绝不递归删子目录
        if (!p.startsWith(dir + path.sep) || !fs.statSync(p).isFile()) continue;
        drift++;
        const rel = path.join(pkg, sub, name);
        if (checkOnly) {
          console.log(`  ✗ 残留 ${rel}`);
        } else {
          fs.rmSync(p);
          console.log(`  ✓ 清理残留 ${rel}`);
        }
      }
    }
  }
}

function copyAvatars() {
  const pairs = [
    ['team.png', 'ai-matrix-team/avatars/team.png'],
    ['team-lead.png', 'aimatrix-team-team-lead/avatars/team-lead.png'],
    ['product-designer.png', 'aimatrix-team-product-designer/avatars/product-designer.png'],
  ];
  // 团队包成员头像按角色短名（r.avatar）命名——必须与 memberEntries() 里
  // `avatars/${r.avatar}` 的引用口径一致，否则成员头像会指向不存在的文件
  for (const r of ROLES) pairs.push([r.avatar, `ai-matrix-team/avatars/${r.avatar}`]);
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
pruneStale(); // 清理旧编制残留（--check 时只报告不删）
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
