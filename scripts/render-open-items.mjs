#!/usr/bin/env node
/**
 * render-open-items — 从 DR 台账渲染 apps/<app>/docs/OPEN-ITEMS.md 的骨架（人类阅读视图）。
 * 用法：node <team-repo>/scripts/render-open-items.mjs --app <app> [--write]
 *   默认打印到 stdout；--write 落盘（保留标记外的既有叙述内容）。
 * 分节映射（04 §7）：A=D1(BLOCKING Type1) · B=D2(凭据) · C=D3(选型) · 其余 BLOCKING 进 A/B/C，NON-BLOCKING 进 C 后附注。
 */
import fs from 'node:fs';
import path from 'node:path';
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
const DR_DIR = path.join(REPO_ROOT, '.ai-matrix-team', 'runtime', 'decisions');

const argv = process.argv.slice(2);
const appIdx = argv.indexOf('--app');
const app = appIdx >= 0 ? argv[appIdx + 1] : null;
const write = argv.includes('--write');
if (!app) { console.error('用法：render-open-items.mjs --app <app> [--write]'); process.exit(1); }

function parseDr(file) {
  const text = fs.readFileSync(file, 'utf8');
  const field = (name) => {
    const m = text.match(new RegExp(`\\|\\s*\\*{0,2}${name}\\*{0,2}\\s*\\|\\s*([^|]*?)\\s*\\|`));
    return m ? m[1].replace(/`/g, '').trim() : '';
  };
  const idM = path.basename(file).match(/DR-\d{8}-\d{3}/);
  return {
    id: idM ? idM[0] : path.basename(file, '.md'),
    owner: field('所属'),
    title: (text.match(/^#\s+(.+)$/m) || [, ''])[1].replace(/^DR-\d{8}-\d{3}\s*·\s*/, '').trim(),
    blocking: /BLOCKING/i.test(field('阻塞级别')) && !/NON/i.test(field('阻塞级别')),
    trigger: (field('触发类型').match(/D[1-6]/) || ['D5'])[0],
    status: field('status') || field('状态') || 'OPEN',
  };
}

const drs = [];
for (const sub of ['open', 'closed']) {
  const dir = path.join(DR_DIR, sub);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/^DR-\d{8}-\d{3}.*\.md$/.test(f)) continue;
    const d = parseDr(path.join(dir, f));
    if (sub === 'closed') d.status = 'ANSWERED';
    if (!d.owner.includes(`App: \`${app}\``) && !d.owner.includes(app)) continue;
    drs.push(d);
  }
}

const section = (label, want) => {
  const items = drs.filter((d) => d.status === 'OPEN' && want(d));
  if (!items.length) return `## ${label}\n\n（暂无）\n`;
  return `## ${label}\n\n${items.map((d) => `- [${d.id}] ${d.title}（${d.trigger}）`).join('\n')}\n`;
};

const rendered = `<!-- render-open-items:start（本段由 <team-repo>/scripts/render-open-items.mjs 生成；DR 是唯一真相源，禁止在此手改台账数据） -->
${section('A. 需要你拍板（Type 1 不可逆）', (d) => d.trigger === 'D1')}
${section('B. 需要你提供（凭据 / 资金 / 账号）', (d) => d.trigger === 'D2')}
${section('C. 需要你做技术选型 / 其他待决策', (d) => d.trigger === 'D3' || d.trigger === 'D4' || d.trigger === 'D5' || d.trigger === 'D6')}
${section('F. 风险登记', () => false)}
<!-- render-open-items:end -->
`;

const target = path.join(REPO_ROOT, 'apps', app, 'docs', 'OPEN-ITEMS.md');
if (!write) { console.log(`[dry-run] ${path.relative(REPO_ROOT, target)}\n`); console.log(rendered); process.exit(0); }
fs.mkdirSync(path.dirname(target), { recursive: true });
if (!fs.existsSync(target)) {
  fs.writeFileSync(target, `# ${app} · OPEN-ITEMS\n\n${rendered}`);
  console.log(`✅ 已创建 ${path.relative(REPO_ROOT, target)}`);
  process.exit(0);
}
const cur = fs.readFileSync(target, 'utf8');
const S = '<!-- render-open-items:start';
const E = '<!-- render-open-items:end -->';
const si = cur.indexOf(S), ei = cur.indexOf(E);
let next;
if (si >= 0 && ei > si) next = cur.slice(0, si) + rendered.trimEnd() + '\n' + cur.slice(ei + E.length);
else next = cur.trimEnd() + '\n\n' + rendered;
fs.writeFileSync(target, next);
console.log(`✅ 已同步 ${path.relative(REPO_ROOT, target)}（标记外内容保留）`);
