/**
 * WorkBuddy harness 适配器（v1：纯登记制）
 *
 * WorkBuddy 原生边界：
 * - REST 控制面 daemon（9527）本机未开；桌面端端口需鉴权，非官方契约；
 * - 队友实例是会话内嵌套 agent，不落 workbuddy.db.sessions 表；
 * ⇒ 「实例 → 会话」无法自动内省，由 spawn 者（Hugo）派单时登记 instances.json。
 *
 * 扩展点（加探测时必须遵守 harness/index.mjs 铁律 #2）：
 * - daemon REST：GET /api/v1/jobs（实例）+ /api/v1/sessions（会话名）——须 async + 500ms 超时 + TTL 负缓存；
 * - wbipc unix socket：~/.workbuddy/wbipc/endpoint.json。
 */
import { readInstancesFile } from './index.mjs';

export default {
  id: 'workbuddy',
  label: 'WorkBuddy',
  instances() {
    try {
      return readInstancesFile().filter((i) => (i.harness || 'workbuddy') === 'workbuddy');
    } catch {
      return [];
    }
  },
};
