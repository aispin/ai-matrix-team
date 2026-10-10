#!/usr/bin/env node
/**
 * ledger-sync — 扫描 decisions/open 与 closed，重建 LEDGER.md（唯一机读真相源）。
 * 用法：node <team-repo>/scripts/ledger-sync.mjs [--check]
 * --check：只校验 LEDGER 是否与 DR 文件一致（CI 用），不一致退出码 5。
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
const LEDGER = path.join(DR_DIR, 'LEDGER.md');

function parseDr(file) {
  const text = fs.readFileSync(file, 'utf8');
  const field = (name) => {
    const m = text.match(new RegExp(`\\|\\s*\\*{0,2}${name}\\*{0,2}\\s*\\|\\s*([^|]*?)\\s*\\|`));
    return m ? m[1].replace(/`/g, '').trim() : '';
  };
  const idM = path.basename(file).match(/DR-\d{8}-\d{3}/);
  return {
    id: idM ? idM[0] : path.basename(file, '.md'),
    by: field('提出者'),
    owner: field('所属'),
    title: (text.match(/^#\s+DR-\d{8}-\d{3}\s*·\s*(.+)$/m) || [, ''])[1].trim(),
    type: field('决策类型'),
    blocking: /BLOCKING/i.test(field('阻塞级别')) && !/NON/i.test(field('阻塞级别')) ? 'BLOCKING' : 'NON-BLOCKING',
    status: field('状态') || 'OPEN',
    date: field('提出日期'),
    deadline: field('期限'),
  };
}

const rows = [];
for (const sub of ['open', 'closed']) {
  const dir = path.join(DR_DIR, sub);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/^DR-\d{8}-\d{3}.*\.md$/.test(f)) continue;
    const d = parseDr(path.join(dir, f));
    if (sub === 'closed' && d.status === 'OPEN') d.status = 'ANSWERED'; // closed 目录一律已闭环
    rows.push(d);
  }
}
rows.sort((a, b) => a.id.localeCompare(b.id));

const header = `<!-- 由 <team-repo>/scripts/ledger-sync.mjs 自动维护；手改会被覆盖。改数据请改 DR 文件后重跑本脚本。 -->
# DR 台账（LEDGER）

| id | 提出者 | 所属 WO/App | 一句话 | 类型 | 阻塞 | 状态 | 提出日 | 期限 |
|---|---|---|---|---|---|---|---|---|
`;
const body = rows.map((r) =>
  `| ${r.id} | ${r.by} | ${r.owner} | ${r.title} | ${r.type} | ${r.blocking} | ${r.status} | ${r.date} | ${r.deadline} |`
).join('\n') + '\n';
const next = header + (rows.length ? body : '| —（暂无 DR） | | | | | | | | |\n');

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8') : '';
  const strip = (s) => s.split('\n').filter((l) => !l.startsWith('<!--')).join('\n');
  if (strip(cur) !== strip(next)) {
    console.error('LEDGER.md 与 DR 文件不一致 → 跑 ledger-sync.mjs 重建。');
    process.exit(5);
  }
  console.log('LEDGER.md 与 DR 文件一致。');
  process.exit(0);
}

fs.writeFileSync(LEDGER, next);
console.log(`✅ LEDGER.md 已重建：${rows.length} 条 DR（open ${rows.filter((r) => r.status === 'OPEN').length}）。`);
