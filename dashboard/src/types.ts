export interface Member {
  id: string;
  name: string;
  role: string;
  stage: string;
  color: string;
  desc: string;
  busy?: string;
  busyList?: string[];
  working?: boolean;
}

export interface WorkorderRow { id: string; purpose: string; executor?: string; guard?: string; status?: string; callsign?: string | null; session?: string | null; }
export interface InstanceRow { callsign: string; session?: string; wo?: string; startedAt?: string; harness?: string; }
export interface DecisionRow { id: string; oneLine: string; blocking: boolean; status: string; due?: string; }
export interface Inspection { file: string; summary: string; }

/** 单个持锁者（schema 2 面域分片模型：一个公共区可被多个面域不相交的单同时占用）。 */
export interface LockHolder { wo: string; since: string; }

/**
 * 锁字段的规范形状（schema 2）：服务端把 `lock.json` 归一为
 * `{ holders: [{wo, since}], count }`；无锁时为 `null`。这是常规形状。
 */
export interface LockHolders { holders: LockHolder[]; count: number; }

/**
 * legacy 单持有者形状：`server.mjs` 改造前把 `lock.json` 压成的
 * `{ holder, since }` 单对象（无锁时为 `null`）。
 *
 * 注意：这**不是**常规形状，只在**版本错配窗口**出现——`dist` 已用新前端重建、
 * 但运行中的旧 `server.mjs` 进程尚未重启，于是新前端 JS 拿到的是旧 API 形状。
 * 该窗口内对 `lock.holders` 直接 `.map` 会抛 `TypeError`（`src/` 无 ErrorBoundary → 整页白屏），
 * 故前端必须把此分支作为**降级路径**安全消费。
 */
export interface LegacyLock { holder: string; since: string; }

/**
 * `/api/pipeline` 的 `lock` 字段类型：两种形状的联合 + 空闲。
 * - `LockHolders`：schema 2 规范形状（常规）。
 * - `LegacyLock`：版本错配窗口内的降级形状（新前端 × 旧 server）。
 * - `null`：公共区空闲。
 * 消费侧须先做形状判别，**不得对 undefined 调 `.map`**。
 */
export type LockState = LockHolders | LegacyLock;

export interface Pipeline {
  project: { name: string; description: string; packageManager: string };
  terms: { wo: string; dr: string; lock: string };
  harness?: { id: string; label: string };
  instances?: InstanceRow[];
  lock: LockState | null;
  members: Member[];
  activeWorkorders: WorkorderRow[];
  closedWorkorders: WorkorderRow[];
  decisions: { open: DecisionRow[]; closedRecent: DecisionRow[] };
  inspection: Inspection | null;
}

export interface TeamInfo {
  name: string;
  tagline: string;
  about: string;
  capabilities: { title: string; desc: string }[];
  tryAsk: string[];
  dedication?: { title: string; text: string; poem: string[] };
}

export interface ReportListItem { id: number; created_at: string; title: string; }
export interface ReportDetail extends ReportListItem { body_md: string; meta: string; svg?: string | null; }

export interface LedgerDoc { id: string; content_md: string; }

export interface ArtifactItem { type: string; label: string; file: string; path: string; size: number; mtime: string; }
export interface ArtifactsPayload { apps: { app: string; title?: string; items: ArtifactItem[] }[]; shared: ArtifactItem[]; generatedAt: string; }
/** 侧栏展示的运行环境：root = 当前项目根目录，repo = 团队仓 */
export interface EnvInfo { root: string; repo: string; project: string | null; }
/** 产物内容（md/图片 → 弹层；html → 新窗口） */
export interface ArtifactDoc {
  path: string; file: string; kind: 'text' | 'image' | 'html'; size: number; mtime: string;
  rawUrl: string; text: string | null;
}

/* ---------------- 词元（token）消费估算 ---------------- */
export interface TokenFile {
  kind: string;
  label: string;
  file: string;
  date: string;
  tokens: number;
}
export interface TokenKindSummary {
  kind: string;
  label: string;
  tokens: number;
  files: number;
}
export interface TokenSession {
  session: string;
  callsign: string | null;
  wo: string | null;
  startedAt: string | null;
  tokens: number;
}
export interface TokensPayload {
  generatedAt: string;
  disclaimer: string;
  total: number;
  today: number;
  last7: number;
  fileCount: number;
  kinds: TokenKindSummary[];
  daily: { bucket: string; tokens: number }[];
  weekly: { bucket: string; tokens: number }[];
  monthly: { bucket: string; tokens: number }[];
  top: TokenFile[];
  files: TokenFile[];
  sessions: TokenSession[];
}
