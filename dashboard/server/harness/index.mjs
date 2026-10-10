/**
 * Agent harness 适配层（DR-20261005-003 /）
 *
 * 目的：把「实例 ↔ 会话归属」这类与具体 agent 运行环境（harness）相关的代码隔离在此，
 * 将来接入 codex（代码代理命令行工具）等只需新增适配器，dashboard 与 guard 不改。
 *
 * 适配器契约（每个 harness 一个 ./<id>.mjs，export default）：
 * {
 * id: 'workbuddy', // harness 标识（instances.json 条目的 harness 字段匹配；缺省视为 workbuddy）
 * label: 'WorkBuddy', // 展示名
 * instances: [ // 同步、fail-soft、绝不抛错
 * { callsign, session, wo, startedAt, harness }
 * ]
 * }
 *
 * 「约定即注册」：harness 目录下有 <id>.mjs 即视为该环境已注册，无需改动任何清单文件；
 * 删掉该文件，再次启动就自动落回兜底视图，无需改代码。
 *
 * 环境标识（harness id）命名规则：必须匹配正则 /^[a-z0-9][a-z0-9-]{0,31}$/
 * —— 只认小写字母、数字与连字符，首位不得为连字符，总长 1–32 字符。
 * 与文件名 `<id>.mjs`、登记表条目的 harness 字段、控制台选择项三者同名，一条 id 贯穿到底。
 *
 * 铁律（创始人裁定：不能堵塞正常使用）：
 * 1. 适配器只做「读」，主路径同步返回登记数据；
 * 2. 任何探测类扩展（后台服务接口 / 本机进程间通信 / 数据库内省）必须 async + 超时（≤500ms）+ TTL 负缓存，
 * 失败时静默降级为登记数据——禁止让 dashboard 端点因此变慢或报错；
 * 3. 新接入 harness：登记表条目写 `harness: '<id>'`，并新增 ./<id>.mjs 实现同契约。
 *
 * 登记表（gitignore 运行态，spawn 者登记 / 收工注销）：
 * 主径：<项目根>/.ai-matrix-team/runtime/state/instances.json（项目根由 server.mjs 注入本模块）
 * 回退：<团队仓>/runtime/state/instances.json（团队仓尚未随新目录结构迁移时的旧位置）
 * 条目：[{ callsign: 'PC哥#1', session: '会话名', wo: 'WO-…', startedAt: ISO, harness?: 'workbuddy' }]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
/** 旧登记表路径：<团队仓>/runtime/state/instances.json（团队仓 dashboard/ 尚未随项目运行时迁移时的旧位置） */
const LEGACY_INSTANCES_FILE = path.resolve(HARNESS_DIR, '..', '..', '..', 'runtime', 'state', 'instances.json');
/** 兼容导出：旧路径常量保留给白名单外历史消费者；实际读取以 instancesFilePath 为准 */
export const INSTANCES_FILE = LEGACY_INSTANCES_FILE;

/** 项目根：由 server.mjs 在解析 harness 之前调用 setProjectRoot 注入一次 */
let projectRoot = null;

/** 注入项目根（P2：修登记表路径偏移）· idempotent，重复调用以最后一次为准 */
export function setProjectRoot(root) {
  if (typeof root === 'string' && root.trim()) projectRoot = path.resolve(root.trim());
}

/** 当前生效的项目根：显式注入 > 环境变量 AIMATRIX_PROJECT_ROOT / AIM_PROJECT_ROOT */
function projectRootDir() {
  const envRoot = process.env.AIMATRIX_PROJECT_ROOT || process.env.AIM_PROJECT_ROOT;
  return projectRoot || (envRoot ? path.resolve(envRoot) : null);
}

/**
 * 登记表候选路径（按优先级）：项目根口径优先，团队仓旧路径兜底。
 * 返回首个**存在**的路径；都不存在时返回旧路径（读取自然为空列表，符合 fail-soft）。
 */
export function instancesFilePath() {
  const root = projectRootDir();
  const projectFile = root ? path.join(root, '.ai-matrix-team', 'runtime', 'state', 'instances.json') : null;
  if (projectFile && fs.existsSync(projectFile)) return projectFile;
  return LEGACY_INSTANCES_FILE;
}

/** 读登记表（fail-soft：文件缺失 / 坏 JSON / 顶层非数组，一律返回空数组） */
export function readInstancesFile() {
  try {
    const data = JSON.parse(fs.readFileSync(instancesFilePath(), 'utf8'));
    // 顶层非数组（如误写成字符串或对象）时不得往下传，否则调用方 .filter 会抛类型错误
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * 环境标识（harness id）合法性 + 存在性 + 路径规范化，三重事前拦截（P1）。
 * 必须在 import **之前**判定：契约校验是事后行为，挡不住被执行模块的副作用。
 */
export function isRegisteredHarness(id) {
  if (typeof id !== 'string' || !id) return false;
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(id)) return false;          // ① 正则：拒 ../ 、/ 、大写、连字符开头、超长
  let files = [];
  try { files = fs.readdirSync(HARNESS_DIR); } catch { return false; }
  const known = files.filter((f) => f.endsWith('.mjs') && f !== 'index.mjs').map((f) => f.slice(0, -4));
  if (!known.includes(id)) return false;                            // ② 枚举：目录里必须真有 <id>.mjs
  return path.resolve(HARNESS_DIR, `./${id}.mjs`) === path.join(HARNESS_DIR, `${id}.mjs`); // ③ 保险杠：规范化后仍落在目录内
}

/** 按配置解析 harness；未通过事前拦截或契约不符降级 generic（只读登记表，展示全部条目） */
export async function resolveHarness(preferred) {
  const id = preferred || process.env.AIMATRIX_HARNESS || 'workbuddy';
  if (isRegisteredHarness(id)) {
    try {
      const mod = await import(`./${id}.mjs`);
      if (mod.default && typeof mod.default.instances === 'function') return mod.default;
    } catch {
      /* 加载失败或契约不符 → 落兜底，不抛 */
    }
  }
  return (await import('./generic.mjs')).default;
}
