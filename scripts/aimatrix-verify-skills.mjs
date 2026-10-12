#!/usr/bin/env node
/**
 * aimatrix-verify-skills.mjs · AI Matrix Team 激活入口只读校验
 *
 * 校验逻辑（不硬编码团队仓路径）：
 *   扫描目标项目的候选技能目录（存在才查）：
 *     .workbuddy/skills/ · .claude/skills/ · .agents/skills/
 *   每处校验 ai-matrix-team/SKILL.md：
 *     存在 → 是软链 → 解析目标具备真源特征
 *     （frontmatter 含 `name: ai-matrix-team` 且其所在仓根有 members/ 目录）。
 *   Codex 入口（存在才查）：项目根 AGENTS.md——含 `managed-by: ai-matrix-team`
 *     标记才视为 AIM-T 管辖，校验其中的 SKILL.md 指针可达真源；无标记视为项目
 *     自有文件，不代管、不判失败。
 *   布局约定：真目录 + 链单个 SKILL.md 文件——平台递归扫描技能目录时，
 *   链仓根会把岗位技能（aimatrix-<role>）再次暴露出来；文件级链接在
 *   递归 / 非递归两种行为下都只暴露这一个入口。岗位技能不进任何技能列表，
 *   agent 按团队仓路径直读 <TEAM>/aimatrix-<role>/SKILL.md。
 *
 * 附带报告（不判失败）：发现 aimatrix-* 岗位技能链且指向真源特征仓 → 提示清理
 * （岗位技能不该挂在用户技能列表下）。
 *
 * 用法：
 * node <team-repo>/scripts/aimatrix-verify-skills.mjs --project <项目根> [--json]
 *
 * 退出码：0 全绿 · 1 缺失 / 漂移 · 3 用法错误
 */

import fs from 'node:fs';
import path from 'node:path';

const ENTRY = 'ai-matrix-team';
const SKILL_DIRS = ['.workbuddy/skills', '.claude/skills', '.agents/skills'];

function parseArgs(argv) {
  const args = { project: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--project' || a === '--root') args.project = argv[++i];
    else if (a === '-h' || a === '--help') args.help = true;
    else throw new Error(`未知参数：${a}`);
  }
  if (!args.help && !args.project) throw new Error('缺 --project <项目根>');
  return args;
}

const lstat = (p) => { try { return fs.lstatSync(p); } catch { return null; } };
const readLink = (p) => { try { return fs.readlinkSync(p); } catch { return null; } };

/** 真源 SKILL.md 特征：frontmatter 含 name: ai-matrix-team，且同目录有 members/ */
function isGenuineSkill(file) {
  let body = '';
  try { body = fs.readFileSync(file, 'utf8').slice(0, 400); } catch { return false; }
  if (!/^name:\s*ai-matrix-team\s*$/m.test(body)) return false;
  return lstat(path.join(path.dirname(file), 'members'))?.isDirectory?.() === true;
}

/** 路径是否位于真源特征仓内（从该路径向上找 members/ + name 匹配的 SKILL.md） */
function insideTeamRepo(p) {
  let cur = p;
  for (let i = 0; i < 5; i++) {
    if (isGenuineSkill(path.join(cur, 'SKILL.md'))) return true;
    const up = path.dirname(cur);
    if (up === cur) return false;
    cur = up;
  }
  return false;
}

/** 校验一个技能目录下的入口；返回 { state, detail, legacy } */
function inspectSkillsDir(root, base) {
  const dir = path.join(root, base);
  const file = path.join(dir, ENTRY, 'SKILL.md');
  let state = 'ok', detail = '';
  const st = lstat(file);
  if (!st) {
    // 项目从未在该平台装过技能目录 → 视为未接入该平台，不算漂移
    state = lstat(path.join(root, base)) ? 'missing' : 'n/a';
    if (state === 'missing') detail = `${base}/${ENTRY}/SKILL.md 不存在`;
  } else if (!st.isSymbolicLink()) {
    state = 'drift'; detail = 'SKILL.md 是真实文件副本，不是指向真源的软链';
  } else {
    const resolved = path.resolve(path.dirname(file), readLink(file) || '');
    if (!insideTeamRepo(resolved)) {
      state = 'drift'; detail = `软链目标不具备真源特征：${readLink(file)}`;
    } else {
      detail = `→ ${path.relative(root, resolved)}`;
    }
  }
  // 岗位技能链残留（aimatrix-*，指向真源特征仓才报告）
  const legacy = [];
  if (lstat(dir)?.isDirectory?.()) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isSymbolicLink() || !e.name.startsWith('aimatrix-')) continue;
      const p = path.join(dir, e.name);
      const resolved = path.resolve(dir, readLink(p) || '');
      if (insideTeamRepo(resolved)) legacy.push(p);
    }
  }
  return { base, state, detail, legacy };
}

/** 校验 Codex 入口 AGENTS.md 壳；返回 { state, detail }（无标记 = n/a，不代管项目自有文件） */
function inspectAgentsShell(root) {
  const file = path.join(root, 'AGENTS.md');
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return { state: 'n/a', detail: '' }; }
  if (!text.includes('managed-by: ai-matrix-team')) return { state: 'n/a', detail: '（存在但非 AIM-T 管辖）' };
  // 指针提取：markdown 链接 / 反引号 / 以 / . / $ 开头的路径 token（防止把中文前缀等非路径文本吃进路径）
  const m = text.match(/\(([^()\s]*SKILL\.md)\)/) || text.match(/`([^`\s]*SKILL\.md)`/) || text.match(/((?:\/|\.\/|\$[\w-]+\/)[^\s`()]*SKILL\.md)/);
  if (!m) return { state: 'drift', detail: '有 managed 标记但缺 SKILL.md 指针' };
  const resolved = path.resolve(root, m[1]);
  if (!insideTeamRepo(resolved)) return { state: 'drift', detail: `指针不可达真源：${m[1]}` };
  return { state: 'ok', detail: `→ ${m[1]}` };
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(`参数错误：${e.message}`); process.exit(3); }
  if (args.help) {
    console.log('用法：node aimatrix-verify-skills.mjs --project <项目根> [--json]');
    process.exit(0);
  }

  const root = path.resolve(args.project);
  const results = SKILL_DIRS.map((b) => inspectSkillsDir(root, b));
  results.push({ base: 'AGENTS.md', ...inspectAgentsShell(root) });
  const lines = [];

  for (const r of results) {
    if (r.state === 'n/a') continue; // 平台未使用 / 非 AIM-T 管辖，静默
    const mark = { ok: '=', missing: '!', drift: '!' }[r.state];
    lines.push(`${mark} ${r.base}${r.base === 'AGENTS.md' ? '' : '/' + ENTRY + '/SKILL.md'}：${r.state}${r.detail ? ' — ' + r.detail : ''}`);
    for (const p of r.legacy || []) lines.push(`  ! 残留岗位技能链 ${path.relative(root, p)}（应删除：岗位技能按团队仓路径直读，不进技能列表）`);
  }

  const problems = results.filter((r) => r.state === 'missing' || r.state === 'drift');
  // 任一平台「目录存在但入口缺失/漂移」即失败；legacy 残留不判失败但计入输出
  if (!args.json) {
    if (!lines.length) console.log(`${root}：未发现已接入的激活入口（各平台均未接入）`);
    else console.log(lines.join('\n'));
  }

  const exit = problems.length ? 1 : 0;
  if (args.json) {
    process.stdout.write(JSON.stringify({
      project: root,
      entries: results.map(({ base, state, detail, legacy }) => ({ base, state, detail, legacy: (legacy || []).length })),
      exit,
    }, null, 2) + '\n');
  }
  process.exit(exit);
}

main();
