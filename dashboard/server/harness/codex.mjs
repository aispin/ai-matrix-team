/**
 * Codex harness 适配器（v1：纯登记制）
 *
 * harness（Agent 运行环境，指成员实际干活的工具）适配层的「约定即注册」实例：
 * harness 目录中有 <id>.mjs 即视为该环境已注册，无需改动任何清单文件。
 *
 * 数据来源：登记表 <项目根>/.ai-matrix-team/runtime/state/instances.json
 * （由 server.mjs 通过 setProjectRoot 注入项目根；缺失时回退团队仓旧路径）
 *
 * 过滤口径：与既有 WorkBuddy 适配器同一个公式换了一个 id——
 * 登记条目缺 harness 字段时按 'workbuddy' 计（兼容历史数据，不要求补写），
 * 因此本视图**只**返回显式登记为 'codex' 的条目。
 *
 * 契约（详见 harness/index.mjs 头部）：同步、fail-soft（失败静默降级为空列表）、绝不抛错。
 */
import { readInstancesFile } from './index.mjs';

export default {
  id: 'codex',
  label: 'Codex',
  instances() {
    try {
      return readInstancesFile().filter((item) => item && typeof item === 'object' && (item.harness || 'workbuddy') === 'codex');
    } catch {
      return [];
    }
  },
};
