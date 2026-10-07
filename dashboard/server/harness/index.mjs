/**
 * Agent harness 适配层（DR-20261005-003 / WO-20261005-13）
 *
 * 目的：把「实例 ↔ 会话归属」这类与具体 agent 运行环境（harness）相关的代码隔离在此，
 *       将来接入 codex / deepseek harness 等只需新增适配器，dashboard 与 guard 不改。
 *
 * 适配器契约（每个 harness 一个 ./<id>.mjs，export default）：
 *   {
 *     id: 'workbuddy',                    // harness 标识（instances.json 条目的 harness 字段匹配；缺省视为 workbuddy）
 *     label: 'WorkBuddy',                 // 展示名
 *     instances(): [                      // 同步、fail-soft、绝不抛错
 *       { callsign, session, wo, startedAt, harness }
 *     ]
 *   }
 *
 * 铁律（创始人裁定：不能堵塞正常使用）：
 *   1. 适配器只做「读」，主路径同步返回登记数据；
 *   2. 任何探测类扩展（daemon REST / wbipc / 数据库内省）必须 async + 超时（≤500ms）+ TTL 负缓存，
 *      失败时静默降级为登记数据——禁止让 dashboard 端点因此变慢或报错；
 *   3. 新接入 harness：instances.json 条目写 `harness: '<id>'`，并新增 ./<id>.mjs 实现同契约。
 *
 * 登记文件：.skills/runtime/state/instances.json（gitignore 运行态，spawn 者登记 / 收工注销）
 *   [{ callsign: 'PC哥#1', session: '会话名', wo: 'WO-…', startedAt: ISO, harness?: 'workbuddy' }]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const INSTANCES_FILE = path.resolve(__dirname, '..', '..', '..', 'runtime', 'state', 'instances.json');

/** 读登记表（fail-soft：文件缺失 / 坏 JSON 一律返回空数组） */
export function readInstancesFile() {
  try { return JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf8')); } catch { return []; }
}

/** 按配置解析 harness；加载失败降级 generic（只读登记表，展示全部条目） */
export async function resolveHarness(preferred) {
  const id = preferred || process.env.AIMATRIX_HARNESS || 'workbuddy';
  try {
    const mod = await import(`./${id}.mjs`);
    if (mod.default && typeof mod.default.instances === 'function') return mod.default;
    throw new Error('契约不符');
  } catch {
    return (await import('./generic.mjs')).default;
  }
}
