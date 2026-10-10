/**
 * 通用 harness 兜底适配器：任何 agent 运行环境都能用——只读登记表，展示全部条目。
 * 接入新 harness 前（或 harness 加载失败）由 resolveHarness 自动落到这里。
 */
import { readInstancesFile } from './index.mjs';

export default {
  id: 'generic',
  label: '通用（仅登记表）',
  instances() {
    try { return readInstancesFile(); } catch { return []; }
  },
};
