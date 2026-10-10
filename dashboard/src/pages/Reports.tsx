import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../icon';
import { Markdown } from '../markdown';
import { Button, Skeleton } from '@heroui/react';
import { TokenStrip } from './Tokens';
import type { ReportDetail } from '../types';

type ViewMode = 'svg' | 'md';

interface Props {
  selectedId: number | null;
  detail: ReportDetail | null;
  reportErr: string | null;
  mode: ViewMode;
  fullscreen: boolean;
  setFullscreen: (v: boolean) => void;
  reload: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;

/** 全屏灯箱：点击 SVG 打开，滚轮缩放 / 拖拽平移 / 双击 1x↔2x / Esc 关闭（特殊交互保留自绘，工具条按钮 HeroUI 化） */
function Lightbox({ svg, onClose }: { svg: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Esc 关闭 + 方向键微调平移
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(MAX_SCALE, s * 1.25));
      if (e.key === '-') setScale((s) => Math.max(MIN_SCALE, s / 1.25));
      if (e.key === '0') {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clampOffset = useCallback((s: number, o: { x: number; y: number }) => {
    // 允许平移范围随缩放放宽：缩得比 1 小时锁回中心
    const slack = Math.max(0, (s - 1)) * 600 + 80;
    return {
      x: Math.max(-slack, Math.min(slack, o.x)),
      y: Math.max(-slack * 1.5, Math.min(slack * 1.5, o.y)),
    };
  }, []);

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      setScale((s) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor));
        if (cx != null && cy != null) {
          // 以鼠标位置为缩放中心
          setOffset((o) => clampOffset(next, { x: cx - ((cx - o.x) * next) / s, y: cy - ((cy - o.y) * next) / s }));
        } else {
          setOffset((o) => clampOffset(next, o));
        }
        return next;
      });
    },
    [clampOffset],
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - window.innerWidth / 2, e.clientY - window.innerHeight / 2);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return; // 1x 无需平移
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset(clampOffset(scale, { x: drag.current.ox + (e.clientX - drag.current.px), y: drag.current.oy + (e.clientY - drag.current.py) }));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      zoomAt(2, e.clientX - window.innerWidth / 2, e.clientY - window.innerHeight / 2);
    }
  };

  return (
    <div className="lightbox-mask" onClick={onClose} role="dialog" aria-label="全屏查看汇报图">
      {/* 工具条：阻止冒泡，避免误关 */}
      <div className="lightbox-tools" onClick={(e) => e.stopPropagation()}>
        <Button isIconOnly variant="ghost" size="sm" onPress={() => zoomAt(1 / 1.25)} aria-label="缩小">
          <Icon name="minus" size={18} />
        </Button>
        <span className="lightbox-pct">{Math.round(scale * 100)}%</span>
        <Button isIconOnly variant="ghost" size="sm" onPress={() => zoomAt(1.25)} aria-label="放大">
          <Icon name="plus" size={18} />
        </Button>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          onPress={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}

          aria-label="重置"
        >
          <Icon name="reset" size={18} />
        </Button>
        <Button isIconOnly variant="ghost" size="sm" className="lightbox-close" onPress={onClose} aria-label="关闭">
          <Icon name="close" size={18} />
        </Button>
      </div>

      <div
        className={`lightbox-stage${dragging ? ' dragging' : ''}${scale > 1 ? ' zoomed' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div
          className="lightbox-svg"
          style={{ transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {scale > 1 && <div className="lightbox-hint">拖拽平移 · 双击复位</div>}
    </div>
  );
}

/** 汇报查看器：历史清单在侧栏子菜单区（App 渲染），这里只做全高内容展示（图/文双模式）。 */
export default function Reports({ selectedId, detail, reportErr, mode, fullscreen, setFullscreen, reload }: Props) {
  // 灯箱打开时锁页面滚动
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // 老汇报没有图形版时自动落到文字版
  const showSvg = mode === 'svg' && !!detail?.svg;

  // 错误态：带重试与启动提示（B-2 接线 --danger-soft + offline 图标 + refresh 重试）
  if (reportErr) {
    return (
      <div className="state-error" role="alert">
        <Icon name="offline" size={22} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">加载失败</p>
          <p className="subtle mt-0.5 text-xs">{reportErr}</p>
          <p className="subtle mt-1 text-xs">数据来自本地台账 · 确认 server.mjs 已启动（node .skills/dashboard/server/server.mjs）</p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" onPress={reload} aria-label="重试">
          <Icon name="refresh" size={16} />
        </Button>
      </div>
    );
  }

  return (
    <>
      <TokenStrip />

      {selectedId == null && (
        <p className="subtle text-sm">还没有汇报。对Hugo说「汇报工作进展」就会生成第一份。</p>
      )}

      {selectedId != null && !detail && (
        <div className="report-skeleton flex flex-col gap-2.5" aria-hidden>
          <Skeleton className="h-[18px] w-2/5 rounded-md" />
          <Skeleton className="h-[14px] w-[90%] rounded-md" />
          <Skeleton className="h-[14px] w-[80%] rounded-md" />
          <Skeleton className="h-[14px] w-[86%] rounded-md" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      {detail && (
        <article className="report-viewer">
          {showSvg ? (
            <div
              className="svg-report"
              dangerouslySetInnerHTML={{ __html: detail.svg! }}
            />
          ) : (
            <Markdown text={detail.body_md} />
          )}
        </article>
      )}

      {fullscreen && detail?.svg && <Lightbox svg={detail.svg} onClose={() => setFullscreen(false)} />}
    </>
  );
}
