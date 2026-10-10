import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Button, Card, Chip, Skeleton } from '@heroui/react';
import { Icon } from '../icon';
import { Markdown } from '../markdown';
import type { ArtifactsPayload, ArtifactItem, ArtifactDoc } from '../types';

const TYPE_COLORS: Record<string, string> = {
  BRD: '#8b5cf6', PRD: '#f59e0b', TDD: '#06b6d4', DESIGN: '#ec4899',
  OVERVIEW: '#10b981', SIGNOFF: '#22c55e', ADR: '#3b82f6', SPEC: '#6b7280', DOC: '#9ca3af',
};

const STAT_TYPES = ['BRD', 'PRD', 'TDD', 'DESIGN', 'ADR'];

const fmtSize = (n: number) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(0) + ' KB' : n + ' B');

const isHtmlPath = (p: string) => /\.x?html?$/i.test(p);

function ItemRow({ it, onOpen }: { it: ArtifactItem; onOpen: (it: ArtifactItem) => void }) {
  const html = isHtmlPath(it.path);
  return (
    <li>
      <button
        type="button"
        className="artifact-row"
        onClick={() => onOpen(it)}
        title={html ? `${it.path}（新窗口打开）` : `${it.path}（点开预览）`}
      >
        <Chip
          size="sm"
          variant="soft"
          className="h-5 shrink-0 !rounded !px-1.5 !text-[10px] font-bold !text-white"
          style={{ background: TYPE_COLORS[it.type] ?? '#9ca3af' }}
          title={it.label}
        >
          {it.type}
        </Chip>
        <span className="min-w-0 flex-1 truncate text-left font-medium">{it.file}</span>
        {html && <Icon name="expand" size={12} className="subtle shrink-0" />}
        <span className="subtle shrink-0 text-[11px]">{fmtSize(it.size)}</span>
        <span className="subtle hidden shrink-0 text-[11px] sm:inline">
          {new Date(it.mtime).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
        </span>
      </button>
    </li>
  );
}

function Group({ title, items, onOpen }: { title: string; items: ArtifactItem[]; onOpen: (it: ArtifactItem) => void }) {
  if (items.length === 0) return null;
  return (
    <Card className="card !p-4">
      <Card.Content className="!p-0">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-sm font-bold">{title}</h3>
          <span className="subtle text-xs">{items.length} 件</span>
        </div>
        <ul className="flex flex-col gap-1">
          {items.map((it) => <ItemRow key={it.path} it={it} onOpen={onOpen} />)}
        </ul>
      </Card.Content>
    </Card>
  );
}

/**
 * 产物清单页（WO-06 第④条；WO-13 HeroUI 化；WO-18 统计卡类型筛选）：
 * 底部悬浮毛玻璃胶囊 dock 按模块筛选（全部 / 各 App / 共享）；
 * 顶部类型统计卡可点击 = 按类型筛选（再点取消），与 dock 双向联动。
 *
 * 点击行为（对齐 WO 单打开交互）：
 * - md / 图片 → 右侧抽屉弹层预览（md 走 Markdown 渲染，图片直出）；
 * - html → 新窗口打开（整页产物无法在抽屉里表达）。
 */
export default function Artifacts() {
  const [data, setData] = useState<ArtifactsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all'); // 'all' | App 名 | 'shared'
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 产物预览抽屉（与 Pipeline 的 WO/DR 抽屉同款交互）
  const [doc, setDoc] = useState<ArtifactDoc | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<ArtifactItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.artifacts().then(setData).catch((e) => setErr(e.message)); }, []);

  const closeDoc = () => { setTarget(null); setDoc(null); setDocErr(null); };

  const openArtifact = async (it: ArtifactItem) => {
    if (isHtmlPath(it.path)) {
      window.open(`/api/artifact?path=${encodeURIComponent(it.path)}&raw=1`, '_blank', 'noopener');
      return;
    }
    setTarget(it); setDoc(null); setDocErr(null); setLoading(true);
    try {
      setDoc(await api.artifact(it.path));
    } catch (e) {
      setDocErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Esc 关闭
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDoc(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target]);

  const copyPath = async () => {
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch { /* 忽略 */ }
  };

  if (err) return <Card className="card !p-6 text-sm">产物清单加载失败：{err}</Card>;
  if (!data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[120px] rounded-xl" />
        <Skeleton className="h-[120px] rounded-xl" />
      </div>
    );
  }

  const all = [...data.apps.flatMap((a) => a.items), ...data.shared];
  const withType = (items: ArtifactItem[]) => (typeFilter ? items.filter((x) => x.type === typeFilter) : items);

  // 当前模块的原始集合（统计卡数字与列表都从这里出发）
  const moduleBase: ArtifactItem[] =
    filter === 'all' ? all : filter === 'shared' ? data.shared : (data.apps.find((g) => g.app === filter)?.items ?? []);

  const visibleApps = (filter === 'all' ? data.apps : data.apps.filter((g) => g.app === filter))
    .map((g) => ({ ...g, items: withType(g.items) }))
    .filter((g) => g.items.length > 0);
  const visibleShared = filter === 'all' || filter === 'shared' ? withType(data.shared) : [];
  const visible = [...visibleApps.flatMap((g) => g.items), ...visibleShared];

  const stats = STAT_TYPES.map((t) => ({ t, n: moduleBase.filter((x) => x.type === t).length }));

  // dock 计数随类型筛选联动：选了类型 → 各模块只数该类型
  const dockN = (items: ArtifactItem[]) => (typeFilter ? items.filter((x) => x.type === typeFilter).length : items.length);
  const modules = [
    { key: 'all', label: '全部', n: dockN(all) },
    ...data.apps.map((g) => ({ key: g.app, label: g.title || g.app, n: dockN(g.items) })),
    { key: 'shared', label: '共享', n: dockN(data.shared) },
  ].filter((m) => m.key === 'all' || m.n > 0);

  const apply = (k: string) => {
    if (k !== filter) {
      // 联动回退：目标模块内没有当前选中类型 → 自动取消类型筛选
      if (typeFilter) {
        const pool = k === 'all' ? all : k === 'shared' ? data.shared : (data.apps.find((g) => g.app === k)?.items ?? []);
        if (!pool.some((x) => x.type === typeFilter)) setTypeFilter(null);
      }
      setFilter(k);
    }
    // 切换模块后回内容顶部（设计稿交互；尊重系统减动效偏好）
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rootRef.current?.closest('main')?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  const toggleType = (t: string) => setTypeFilter((prev) => (prev === t ? null : t));

  return (
    <div ref={rootRef} className="flex flex-col gap-5 pb-16">
      <div className="grid grid-cols-5 gap-2">
        {stats.map((s) => (
          <button
            key={s.t}
            type="button"
            className="card stat-card flex flex-col items-center gap-0.5 !px-2 !py-3"
            data-on={typeFilter === s.t}
            disabled={s.n === 0}
            aria-pressed={typeFilter === s.t}
            title={typeFilter === s.t ? `取消 ${s.t} 筛选` : `只看 ${s.t}`}
            onClick={() => toggleType(s.t)}
          >
            <span className="text-lg font-bold" style={{ color: TYPE_COLORS[s.t] }}>{s.n}</span>
            <span className="subtle text-[11px]">{s.t}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="subtle text-sm">当前筛选下暂无产物。</p>}

      {visibleApps.map((g) => (
        <Group key={g.app} title={(g.title || g.app) + ' · 产物'} items={g.items} onOpen={openArtifact} />
      ))}
      <Group title="矩阵级共享产物（ADR / 规范）" items={visibleShared} onOpen={openArtifact} />

      <p className="subtle text-xs">
        扫描范围：apps/*/docs（BRD·PRD·TDD·设计稿·概览）、docs/product/（矩阵级产品模块·规范）与 docs/（ADR·规范）。生成于 {new Date(data.generatedAt).toLocaleString('zh-CN', { hour12: false })}。
      </p>

      {/* 底部悬浮：毛玻璃胶囊模块筛选 dock */}
      <div className="artifacts-dock-zone">
        <nav className="artifacts-dock" aria-label="按模块筛选产物">
          <span className="artifacts-dock-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16M7 12h10M10 19h4" /></svg>
            模块
          </span>
          {modules.map((m) => (
            <button
              key={m.key}
              type="button"
              className="artifacts-cap"
              data-on={filter === m.key}
              aria-pressed={filter === m.key}
              onClick={() => apply(m.key)}
            >
              {m.label} <span className="artifacts-cap-cnt">{m.n}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 产物预览抽屉：md / 图片（交互对齐 WO 单） */}
      {target && (
        <>
          <div className="drawer-mask" onClick={closeDoc} />
          <aside className="drawer" role="dialog" aria-label={`${target.file} 预览`}>
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-sm font-bold">{target.file}</h3>
                <Chip size="sm" variant="tertiary" className="shrink-0">{doc?.kind === 'image' ? '图片' : '文档'}</Chip>
                <Button variant="ghost" size="sm" className="shrink-0 !min-w-0 !px-2 !text-[11px]" onPress={copyPath} aria-label="复制产物路径">
                  <Icon name={copied ? 'check' : 'copy'} size={13} className="ic-inline" />
                  {copied ? '已复制' : '路径'}
                </Button>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="!min-w-0 !px-2 !text-[11px]"
                  onPress={() => doc && window.open(doc.rawUrl, '_blank', 'noopener')}
                  aria-label="在新窗口打开"
                >
                  <Icon name="expand" size={13} className="ic-inline" />
                  新窗口
                </Button>
                <Button variant="ghost" size="sm" className="!min-w-0 !px-2" onPress={closeDoc} aria-label="关闭">
                  <Icon name="close" size={16} />
                </Button>
              </div>
            </header>
            <div className="drawer-body">
              {docErr && <p className="text-sm" style={{ color: 'var(--danger)' }}>加载失败：{docErr}</p>}
              {loading && <p className="subtle text-sm">加载中…</p>}
              {doc?.kind === 'image' && <img className="artifact-img" src={doc.rawUrl} alt={doc.file} />}
              {doc?.kind === 'text' && doc.text != null && <Markdown text={doc.text} />}
              {doc && (
                <p className="subtle mt-4 pb-6 text-[11px]">
                  {doc.path} · {fmtSize(doc.size)} · 更新于 {new Date(doc.mtime).toLocaleString('zh-CN', { hour12: false })}
                </p>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
