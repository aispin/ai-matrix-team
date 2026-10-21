#!/usr/bin/env node
/**
 * expert-sync.mjs — 成员真源（类）→ 专家包 全链同步工具
 *
 * 真源: <team-repo>/members/<role>.md（五席，唯一允许修改的成员定义）
 * 实例: 专家团包 ai-matrix-team + 独立专家包 aimatrix-team-team-lead / aimatrix-team-product-designer
 *
 * 用法:
 * node scripts/expert-sync.mjs # 写入实例 + 官方 validate→register→package + cache 落位 + installed_plugins 对齐 + 全账号专家白名单登记
 * node scripts/expert-sync.mjs --check # 只报告漂移不写入（退出码 1 = 有漂移，含账号白名单缺失）
 *
 * 账号归属（专家中心「我的专家/专家团」可见性）：
 *   App 侧 ExpertPluginService.scanCustomExperts 扫完 marketplace 条目后，用
 *   readUserExpertIds(userId) 读 <configDir>/experts/custom/<userId>/experts.json（字符串 id 数组）做过滤，
 *   不在数组里的包直接跳过。官方 register_expert.py 只写 marketplace.json（不支持指定账号），
 *   故本脚本直接维护该 id 数组并回读校验。
 *   node scripts/expert-sync.mjs                # 默认：遍历全部已存在账号目录（无账号目录时退回 legacyOwnerUid）
 *   node scripts/expert-sync.mjs --all-users    # 显式声明遍历（等同默认）
 *   node scripts/expert-sync.mjs --user <uid>   # 只登记指定账号
 *   node scripts/expert-sync.mjs --single       # 旧行为：只用 settings.json 的 claw.legacyOwnerUid（逃生阀）
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
// 配置根：与 App 侧 resolveConfigDir 的 HOME 派生分支同口径（沙箱可用 HOME 重定向）。
// 官方 python 脚本另认 WORKBUDDY_CONFIG_DIR，若两者分叉会在 runOfficial 里检测并跳过，绝不跨目录混写。
const CONFIG_DIR = path.join(HOME, '.workbuddy');
const USER_SETTINGS = path.join(CONFIG_DIR, 'settings.json');
const CUSTOM_EXPERTS = path.join(CONFIG_DIR, 'experts', 'custom');
const MP = path.join(CONFIG_DIR, 'plugins/marketplaces/my-experts');
const PLUGINS = path.join(MP, 'plugins');
const CACHE = path.join(CONFIG_DIR, 'plugins/cache/my-experts');
const INSTALLED = path.join(CONFIG_DIR, 'plugins/installed_plugins.json');
const DIST = path.join(HOME, 'WorkBuddy/ISkills/expert-dist');
const EM_SCRIPTS = '/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/expert-manager/scripts';

// ---------------------------------------------------------------- 命令行

const ARGV = process.argv.slice(2);
const checkOnly = ARGV.includes('--check');
const singleMode = ARGV.includes('--single');
const allUsersMode = ARGV.includes('--all-users');
const userIdx = ARGV.indexOf('--user');
const userArg = userIdx >= 0 ? ARGV[userIdx + 1] : undefined;
if (userIdx >= 0 && (!userArg || userArg.startsWith('--'))) {
  console.error('❌ --user 需要一个账号 uid：node scripts/expert-sync.mjs --user <uid>');
  process.exit(2);
}
if (userArg && (singleMode || allUsersMode)) {
  console.error('❌ --user 与 --single / --all-users 互斥');
  process.exit(2);
}
// 早失败：--user 指向不存在的账号目录（在写任何文件之前拦下）
if (userArg && !fs.existsSync(path.join(CUSTOM_EXPERTS, userArg))) {
  console.error(`❌ --user ${userArg} 无对应账号目录：${path.join(CUSTOM_EXPERTS, userArg)}`);
  console.error('   本脚本只登记已存在的账号目录（账号目录由 App 登录时创建），不凭空创建。');
  process.exit(2);
}
const LEGACY_KEYS = ['aimatrix-pm@my-experts', 'hugo@my-experts'];
const LEGACY_PLUGIN_NAMES = ['aimatrix-pm', 'hugo'];

// ---------------------------------------------------------------- 成员元数据（真源登记表）

const ROLES = [
  { file: 'team-lead.md', id: 'aimatrix-team-team-lead', avatar: 'team-lead.png', standalone: true,
    displayName: { en: 'PC', zh: 'PC' },
    profession: { en: 'AI Matrix Delivery Director', zh: 'AIM产研高级总监' },
    soloDescription: 'AI Matrix delivery director PC as a standalone expert: classifies intent into workflows, opens work orders, dispatches with machine gates, owns the DR ledger; also the gatekeeper for controlled surfaces.' },
  { file: 'product-designer.md', id: 'aimatrix-team-product-designer', avatar: 'product-designer.png', standalone: true,
    displayName: { en: 'Mao', zh: '毛毛' },
    profession: { en: 'AI Matrix Senior Product Designer', zh: 'AIM资深产品设计师' },
    soloDescription: 'AI Matrix senior product designer Mao as a standalone expert: BRD then PRD then interactive visual draft in one chain; requirements always carry observable acceptance criteria.' },
  { file: 'developer.md', id: 'aimatrix-team-developer', avatar: 'developer.png', standalone: false,
    displayName: { en: 'Bruce', zh: 'Bruce' },
    profession: { en: 'AI Matrix Senior Development Engineer', zh: 'AIM资深研发工程师' } },
  { file: 'qa.md', id: 'aimatrix-team-qa', avatar: 'qa.png', standalone: false,
    displayName: { en: 'Xue', zh: '石头' },
    profession: { en: 'AI Matrix Senior QA Engineer', zh: 'AIM资深质检工程师' } },
  { file: 'devops.md', id: 'aimatrix-team-devops', avatar: 'devops.png', standalone: false,
    displayName: { en: 'Bo', zh: '波波' },
    profession: { en: 'AI Matrix Senior DevOps Engineer', zh: 'AIM资深运维工程师' } },
];

// 引擎版本：单一版本源 = 团队仓根 VERSION 文件（init 档案戳记、preflight 同源读取）
const TEAM_VERSION = fs.readFileSync(path.join(TEAM_REPO, 'VERSION'), 'utf8').trim() || '0.5.0';
const SOLO_VERSION = '0.1.6';

// ---------------------------------------------------------------- 共享文案（plugin.json 与 README 同源）

// 团队包开场提示语：同时用于 plugin.json 的 quickPrompts 与 README 的「怎么用」，避免两处漂移
const TEAM_QUICK_PROMPTS = [
  { zh: '告诉我 ai-matrix-team 专家团有什么功能，应该怎么用', en: 'Tell me what the AI Matrix Team can do and how to use it' },
  { zh: '帮我打开 ai-matrix-team 指挥台', en: 'Open the AI Matrix Team console for me' },
  { zh: '介绍下 ai-matrix-team 设计师毛毛有什么能力', en: 'Introduce what Mao, the product designer on the AI Matrix Team, can do' },
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
  'devops.md': '发布与回滚（按需席位：仅云后端项目的部署/迁移/事故启用；静态站发布走 git/Pages 由团长直连）',
};

// 五席人设简介（README 专用；真源为 members/*.md 自我介绍段，第三人称口径）
const ROLE_BIO = {
  'team-lead.md': '现京东资深总监，兼职产研首脑。老广东人，短发，薄肌，大抵是个真汉子。他极擅交际，常引来女设计师与产品经理送的小吃。风控的门，便由他守着罢。',
  'product-designer.md': '前京东的美人，黑长直。如今身兼产品、交互、视觉三职。她是极看透了的，喜欢谈恋爱，却不愿踏进婚姻的坟。这大抵是新时代女性的一种清醒罢。',
  'developer.md': '前美团全栈悍将，广东茂名人。终日与编码纠缠还不够，偏要去徒步，去踢足球。南国的烈日，大约给了他无尽的精力。',
  'qa.md': '中通资深研发专家。广西容县人，两眼一睁，便能看穿千万BUG。若想吃正宗沙田柚，找他，大抵是错不了的。',
  'devops.md': '某公司CEO，兼运维工程师。久居西安数十载，80后第一批软件工程师。性格豪爽，极爱饮酒。代码与酒，怕是他生命中唯二的解药。',
};

// 团队介绍（专家中心团队包 README 专用，与项目根 README 同源）
const TEAM_INTRO = `我向来是不惮以最坏的恶意来推测甲方与AI的，然而AI Matrix Team，却实在有些特别。这是一个由五席交付团结成的虚拟产研专家阵线，从需求、产品、设计，一路杀到研发、质检与运维，各守一关。风控的守门人，大抵是落在了团长PC的肩上。他们擅长在共享面的泥沼里理出头绪，在多App的交错中交付，在人机决策的边缘试探。

世人总以为排场越大越好，殊不知人一多，不过是白白烧光了词元（Token），活计却还是那些活计；但若人太少，逻辑又要生出混乱，凭空冒出些幻觉来。五人，不多不少，刚刚好。所谓主创者，不过是于深夜的屏幕前，念及十几年走散在各大厂的旧友。虽各奔东西，终是在这虚拟的矩阵里，重聚了。`;

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
  return `# AI Matrix Team

${TEAM_INTRO}

## 五席分工

| 代号 | 职务 | 负责什么 |
|---|---|---|
${rows}

## 怎么用

在 WorkBuddy 专家中心选择「AI Matrix Team」，用下面任意一句开场即可：

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

${ROLE_BIO[r.file]}

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
    displayName: { en: 'AI Matrix Delivery Team', zh: 'AI Matrix Team' },
    profession: { en: 'AI Matrix Delivery Team', zh: 'AI Matrix Team' },
    displayDescription: {
      // 能力介绍卡（专家中心）；用户定稿鲁迅风全文版
      zh: '我向来是不惮以最坏的恶意来推测甲方与AI的，然而AI Matrix Team，却实在有些特别。这是一个由五席交付团结成的虚拟产研专家阵线，从需求、产品、设计，一路杀到研发、质检与运维，各守一关。擅长在复杂研发项目的泥沼里理出头绪，在多应用多子项目的交错中交付确定性，在人机决策的边缘试探。',
      en: 'I have never shied away from assuming the worst of clients and AI alike — yet AI Matrix Team is truly something else. A virtual product-engineering task force of five seats, each holding one gate from requirements, product and design all the way to dev, QA and ops. They excel at untangling the swamp of complex engineering projects, delivering certainty across intertwined apps and sub-projects, and walking the edge of human-machine decisions.',
    },
    avatar: 'avatars/team.png',
    categoryId: '02-Engineering',
    defaultInitPrompt: {
      zh: '告诉我 ai-matrix-team 专家团有什么功能，应该怎么用',
      en: 'Tell me what the AI Matrix Team can do and how to use it',
    },
    plugin: 'ai-matrix-team',
    tags: [
      // 校验器硬限恰好 3 个：5 项擅长领域合并为 3（项目管理+产品研发、Agent+人机协作）
      { en: 'Shared Surface Governance', zh: '共享面治理' },
      { en: 'PM & Product Engineering', zh: '项目管理 · 产品研发' },
      { en: 'Agent & Human Collaboration', zh: 'Agent · 人机协作' },
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
      en: 'Delivery director and gatekeeper: scopes surfaces, opens work orders with machine gates, holds the risk-control door — a real one, by all accounts.',
      zh: '产研首脑，老广东人，大抵是个真汉子；判面域、开工单——风控的门，便由他守着罢。',
    };
    base.defaultInitPrompt = { zh: '扫一下当前项目的合规状况，给出治理建议', en: 'Audit this project and suggest fixes' };
    base.tags = [
      { zh: '交付管理', en: 'Delivery' },
      { zh: 'AI Matrix', en: 'AI Matrix' },
      { zh: '工作流门禁', en: 'Workflow Gates' },
    ];
    base.quickPrompts = SOLO_QUICK_PROMPTS['aimatrix-team-team-lead'];
  } else {
    base.displayDescription = {
      en: 'One chain — why it matters (BRD) → what & acceptance (PRD) → what it looks like (interactive draft); product, interaction and visual in one seat. Clear-eyed, as befits the new era.',
      zh: '前京东美人，身兼产品、交互、视觉三职；一条链从需求走到设计稿——她大抵是看透了的。',
    };
    base.defaultInitPrompt = { zh: '我有个产品想法，帮我按 Working Backwards 写 BRD、PRD 和可交互设计稿。', en: 'I have a product idea; write a Working Backwards BRD, PRD and an interactive design draft.' };
    base.tags = [
      { zh: '产品设计', en: 'Product Design' },
      { zh: 'BRD PRD 设计稿', en: 'BRD PRD Design' },
      { zh: 'AI Matrix', en: 'AI Matrix' },
    ];
    base.quickPrompts = SOLO_QUICK_PROMPTS['aimatrix-team-product-designer'];
  }
  return base;
}

const manifest = (name, version) => `name: ${name}\nversion: "${version}"\ntype: expert\n`;

// ---------------------------------------------------------------- 动作

let drift = 0;
let skippedSteps = 0; // 上游步骤的「显式跳过」计数（沙箱/无官方脚本），用于收尾如实播报
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
  // 团队包：五席 agent 定义 + 团队头像 team.png + 五席成员头像（与 memberEntries 同一口径）
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
  // 团队包成员头像按角色短名（r.avatar）命名——必须与 memberEntries 里
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
  if (!fs.existsSync(path.join(EM_SCRIPTS, 'register_expert.py'))) {
    console.log('  ℹ 官方 expert-manager 脚本不存在 → 跳过 validate/register/package（源包与账号登记不受影响）');
    skippedSteps++;
    return 0;
  }
  // 官方脚本按 WORKBUDDY_CONFIG_DIR（其次 HOME/.workbuddy）自行定位专家目录；
  // 与本脚本源包目录不一致时（沙箱 HOME 重定向 / 自定义配置根）会校验错位，直接跳过并说明。
  const officialPluginsRoot = path.join(
    (process.env.WORKBUDDY_CONFIG_DIR || '').trim() || path.join(HOME, '.workbuddy'),
    'plugins/marketplaces/my-experts/plugins');
  if (path.resolve(officialPluginsRoot) !== path.resolve(PLUGINS)) {
    console.log(`  ℹ 官方脚本将按 ${officialPluginsRoot} 定位专家包，与本脚本源包 ${PLUGINS} 不一致 → 跳过 validate/register/package`);
    skippedSteps++;
    return 0;
  }
  const py = process.env.PYTHONPATH ? { ...process.env, PYTHONPATH: '' } : { ...process.env };
  const run = (script) => {
    console.log(`  ▸ ${script.split('/').pop()} ${pkgName}`);
    execFileSync('python3', [path.join(EM_SCRIPTS, script), dir], { env: py, stdio: 'inherit' });
  };
  try {
    run('validate_expert.py');
    run('register_expert.py');
    // package 到 expert-dist
    fs.mkdirSync(DIST, { recursive: true });
    console.log('  ▸ package_expert.py');
    execFileSync('python3', [path.join(EM_SCRIPTS, 'package_expert.py'), dir, DIST], { env: py, stdio: 'inherit' });
  } catch (e) {
    console.error(`❌ 官方脚本失败：${pkgName}（${e?.message?.split('\n')[0] ?? e}）`);
    return 1;
  }
  return 0;
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
  if (checkOnly) return 0;
  if (!fs.existsSync(INSTALLED)) {
    console.log(`  ℹ ${INSTALLED} 不存在 → 跳过 installed_plugins 对齐（新环境/沙箱；首次由 App 建库）`);
    skippedSteps++;
    return 0;
  }
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
  return 0;
}

// ---------------------------------------------------------------- 账号归属登记（experts/custom/<uid>/experts.json）
//
// 为什么需要这一段：专家中心对「本地自定义专家」按账号白名单过滤——
// App 侧 ExpertPluginService.scanCustomExperts 扫完 my-experts/plugins/* 后调用
// readUserExpertIds(userId) 读 <configDir>/experts/custom/<userId>/experts.json（裸 id 字符串数组），
// 不在数组里的包直接 continue（跳过）。官方 register_expert.py 只写 marketplace.json，
// 且只认 --marketplace-dir / --session-id，**不支持指定账号** → 账号维度只能由本脚本维护。
// 故这里：遍历账号目录 → 合并式写入 id 数组 → 回读校验；--check 时逐账号比对。

const TEAM_PKG = 'ai-matrix-team';
// 与 App 侧 isUnsafePath 同口径：账号名不得含路径分隔符或 ..，避免写到 custom/ 之外
const SAFE_UID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** 每个账号白名单里必须出现的专家 id：团队包 + 各独立包（由 ROLES 派生，不写死三处） */
const requiredExpertIds = () => [TEAM_PKG, ...ROLES.filter((r) => r.standalone).map((r) => r.id)];

const expertsJsonPath = (uid) => path.join(CUSTOM_EXPERTS, uid, 'experts.json');

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; }
}

/** settings.json 的 claw.legacyOwnerUid（旧单账号行为的唯一账号来源） */
function legacyOwnerUid() {
  const uid = readJsonSafe(USER_SETTINGS)?.claw?.legacyOwnerUid;
  return typeof uid === 'string' && SAFE_UID.test(uid) ? uid : undefined;
}

/** 已存在账号目录（与 App 侧 readAllUserExpertIds 同口径：只认目录，忽略非法名） */
function discoverAccounts() {
  if (!fs.existsSync(CUSTOM_EXPERTS)) return [];
  return fs.readdirSync(CUSTOM_EXPERTS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SAFE_UID.test(d.name))
    .map((d) => d.name)
    .sort();
}

/**
 * 目标账号解析：
 *   --user <uid>      → 仅该账号（必须已存在账号目录，不凭空造账号）
 *   --single          → 旧行为：仅 claw.legacyOwnerUid（逃生阀）
 *   默认 / --all-users → 全部已存在账号；一个都没有时退回旧行为（legacyOwnerUid）
 */
function resolveTargetAccounts() {
  if (userArg) return { accounts: [userArg], mode: '--user', missingDir: !fs.existsSync(path.join(CUSTOM_EXPERTS, userArg)) };
  const legacy = legacyOwnerUid();
  if (singleMode) return { accounts: legacy ? [legacy] : [], mode: '--single（仅 legacyOwnerUid）' };
  const all = discoverAccounts();
  if (all.length) return { accounts: all, mode: allUsersMode ? '--all-users 全账号遍历' : '默认全账号遍历' };
  return { accounts: legacy ? [legacy] : [], mode: '无账号目录 → 退回 legacyOwnerUid' };
}

/** 合并式登记（只增不删、保留原有顺序）；返回本次补了哪些 id */
function mergeAccountExpertIds(uid) {
  const p = expertsJsonPath(uid);
  const cur = readJsonSafe(p);
  const ids = Array.isArray(cur) ? cur.filter((x) => typeof x === 'string') : [];
  const have = new Set(ids);
  const missing = requiredExpertIds().filter((id) => !have.has(id));
  if (!missing.length || checkOnly) return { path: p, missing, wrote: false };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // 格式对齐 App 侧 addUserExperts：JSON 数组 + 2 空格缩进
  fs.writeFileSync(p, JSON.stringify([...ids, ...missing], null, 2), 'utf8');
  return { path: p, missing, wrote: true };
}

/** 回读校验：读回该账号 experts.json，返回仍缺的 id（文件缺失/非法 JSON 都按「全缺」处理） */
function verifyAccount(uid) {
  const cur = readJsonSafe(expertsJsonPath(uid));
  const ids = Array.isArray(cur) ? cur : [];
  return requiredExpertIds().filter((id) => !ids.includes(id));
}

/** 账号维度同步/校验总入口；返回 { failed, usage }（usage = 目标账号无效，属用法错误） */
function syncAccounts() {
  const { accounts, mode, missingDir } = resolveTargetAccounts();
  console.log(`\n== 账号归属${checkOnly ? '校验' : '登记'}（${mode}）==`);
  if (missingDir) {
    console.error(`❌ --user ${userArg} 无对应账号目录：${path.join(CUSTOM_EXPERTS, userArg)}`);
    console.error('   本脚本只登记已存在的账号目录（账号目录由 App 登录时创建），不凭空创建。');
    return { failed: 1, usage: true };
  }
  if (!accounts.length) {
    console.log(`  ℹ 未发现账号目录（${CUSTOM_EXPERTS}）且 settings.json 无 claw.legacyOwnerUid → 跳过账号登记`);
    console.log('    登录一次 WorkBuddy 会生成账号目录；或显式指定：node scripts/expert-sync.mjs --user <uid>');
    return { failed: 0, usage: false };
  }
  let failed = 0;
  if (checkOnly) {
    for (const uid of accounts) {
      const missing = verifyAccount(uid);
      if (missing.length) {
        failed++;
        drift++;
        console.log(`  ✗ 账号 ${uid} 白名单缺 ${missing.join(', ')}`);
        console.log(`    补登记：node scripts/expert-sync.mjs --user ${uid}`);
      } else {
        console.log(`  ✓ 账号 ${uid} 白名单齐全`);
      }
    }
    return { failed, usage: false };
  }
  for (const uid of accounts) {
    const { missing, wrote } = mergeAccountExpertIds(uid);
    console.log(wrote
      ? `  ✓ 登记账号 ${uid}（补 ${missing.join(', ')}）`
      : `  • 已齐全 账号 ${uid}`);
  }
  // 回读校验：写完全部账号后逐个读回，缺 id → 指名账号并非 0 退出（防 watcher 回滚/并发覆盖）
  for (const uid of accounts) {
    const missing = verifyAccount(uid);
    if (missing.length) {
      failed++;
      console.error(`  ✗ 回读校验失败：账号 ${uid} 的 experts.json 仍缺 ${missing.join(', ')}`);
    }
  }
  if (failed) console.error(`❌ 账号登记回读校验失败（${failed}/${accounts.length} 个账号）`);
  else console.log(`✓ 账号登记回读校验通过（${accounts.length} 个账号，id：${requiredExpertIds().join(', ')}）`);
  return { failed, usage: false };
}

// ---------------------------------------------------------------- 岗位 SKILL.md frontmatter 校验

// 护栏：frontmatter 被引言横幅等破坏会导致技能不被注册。
// 校验所有 aimatrix-*/SKILL.md：frontmatter 可提取、name/description 非空、name 与目录名一致。
function validateSkillFrontmatter() {
  const dirs = fs.readdirSync(TEAM_REPO, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^aimatrix-/.test(d.name));
  const errors = [];
  for (const d of dirs) {
    const p = path.join(TEAM_REPO, d.name, 'SKILL.md');
    if (!fs.existsSync(p)) { errors.push(`${d.name}: 缺 SKILL.md`); continue; }
    const raw = fs.readFileSync(p, 'utf8');
    const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!fmMatch) { errors.push(`${d.name}: frontmatter 缺失或格式错误`); continue; }
    const fm = {};
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line);
      if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
    }
    if (!fm.name) errors.push(`${d.name}: frontmatter 缺 name`);
    else if (fm.name !== d.name) errors.push(`${d.name}: name「${fm.name}」与目录名不一致`);
    if (!fm.description) errors.push(`${d.name}: frontmatter 缺 description`);
  }
  if (errors.length) {
    console.error('✗ SKILL.md frontmatter 校验失败：');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`✓ SKILL.md frontmatter 校验通过（${dirs.length} 个岗位技能）`);
}

// ---------------------------------------------------------------- main

console.log(checkOnly ? '== expert-sync CHECK ==' : '== expert-sync SYNC ==');
validateSkillFrontmatter();
const desired = desiredFiles();
writeFileSafe;
for (const [p, content] of desired) {
  const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined;
  if (cur === undefined && path.basename(p) === 'settings.json') {
    if (checkOnly) console.log('  ℹ 源包 settings.json 被 watcher 清理（运行时以 cache 为准，不计漂移）');
    continue;
  }
  if (cur !== content) {
    drift++;
    if (checkOnly) console.log(`  ✗ 漂移 ${path.relative(PLUGINS, p)}`);
  }
}
copyAvatars();
pruneStale(); // 清理旧编制残留（--check 时只报告不删）
if (checkOnly) {
  syncAccounts(); // 账号维度一并计入 drift（缺登记 = 漂移）
  console.log(drift === 0 ? 'CHECK OK：全部实例与真源一致（含账号白名单）' : `CHECK DRIFT：${drift} 处漂移`);
  process.exit(drift === 0 ? 0 : 1);
}
// 写入模式：重写全部期望文件
for (const [p, content] of desired) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
drift = 0; // 已写入
console.log(`✓ 实例已按真源重写（团队包 + ${ROLES.filter((r) => r.standalone).length} 独立包）`);

let pipelineFailed = 0;
pipelineFailed += runOfficial('ai-matrix-team');
for (const r of ROLES.filter((x) => x.standalone)) pipelineFailed += runOfficial(r.id);
cacheInstall('ai-matrix-team', TEAM_VERSION);
for (const r of ROLES.filter((x) => x.standalone)) cacheInstall(r.id, SOLO_VERSION);
pipelineFailed += syncInstalled();
// 账号登记放在最后：即便上游官方步骤降级/失败，白名单也照常补齐并回读校验
const acct = syncAccounts();
if (acct.usage) {
  console.error('❌ 账号登记未执行（目标账号无效），本次同步判定失败');
  process.exit(2);
}
if (acct.failed) process.exitCode = 3;
const problems = pipelineFailed + acct.failed;
console.log(problems
  ? `SYNC 未完成：上游失败 ${pipelineFailed} 步 / 账号失败 ${acct.failed} 个（详见上方 ❌）`
  : skippedSteps
    ? `SYNC DONE（降级）：跳过 ${skippedSteps} 个上游步骤（详见上方 ℹ），账号白名单已按实际账号登记。重开会话生效。`
    : 'SYNC DONE：validate→register→package→cache→installed→账号白名单 全链完成。重开会话生效。');
if (problems) process.exitCode = process.exitCode || 1;
