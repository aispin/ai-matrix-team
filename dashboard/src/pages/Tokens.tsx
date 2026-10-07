import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Icon } from '../icon';
import { Button, Skeleton } from '@heroui/react';
import type { TokensPayload, TokenFile } from '../types';

type Granularity = 'daily' | 'weekly' | 'monthly';

const GRANS: { key: Granularity; label: string }[] = [
  { key: 'daily', label: '按天' },
  { key: 'weekly', label: '按周' },
  { key: 'monthly', label: '按月' },
];

/** 类别配色（浅深主题通用，与品牌蓝同族） */
const KIND_COLORS: Record<string, string> = {
  wo: '#3B5BFD',
  journal: '#7C93FF',
  dr: '#38BDF8',
  handoff: '#34D399',
  review: '#F59E0B',
  log: '#A78BFA',
};

const fmt = (n: number) => (n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : n.toLocaleString('zh-CN'));

/** 词元数据：全量明细由 /api/tokens 提供，前端按会话过滤后自行分桶 */
function useTokenData() {
  const [data, setData] = useState<TokensPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setErr(null);
    api.tokens()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [nonce]);
  return { data, err, reload: () => setNonce((n) => n + 1) };
}

// eslint-disable-next-line import/order
import { api } from '../api';

/** recharts 的 SVG 表现属性不吃 CSS 变量 → 主题切换时换显式色 */
function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const ob = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => ob.disconnect();
  }, []);
  return dark;
}

function bucketKey(date: string, g: Granularity): string {
  if (g === 'daily') return date;
  if (g === 'monthly') return date.slice(0, 7);
  // ISO 周
  const d = new Date(date + 'T00:00:00Z');
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear();
  const w = Math.ceil(((d.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="tok-stat">
      <p className="subtle text-xs">{label}</p>
      <p className="tok-stat-value">{value}</p>
      {hint && <p className="subtle text-[11px]">{hint}</p>}
    </div>
  );
}

/** 汇报页顶部统计段（词元页的紧凑版） */
export function TokenStrip() {
  const { data, err } = useTokenData();
  if (err) return null; // 汇报主内容不受统计段影响
  if (!data) {
    return (
      <div className="tok-strip flex gap-2">
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <Skeleton className="h-14 flex-1 rounded-xl" />
      </div>
    );
  }
  return (
    <section className="tok-strip" aria-label="词元消费统计">
      <div className="flex items-center gap-1.5">
        <Icon name="token" size={15} />
        <span className="text-[13px] font-semibold">词元消费统计</span>
        <span className="subtle text-[11px]">{data.disclaimer}</span>
      </div>
      <div className="tok-strip-cards">
        <StatCard label="今日" value={fmt(data.today)} hint="按单据/日志估算" />
        <StatCard label="近 7 天" value={fmt(data.last7)} hint={`单据 ${data.fileCount} 份累计`} />
        <StatCard label="累计" value={fmt(data.total)} hint="open + closed + 日志" />
        <StatCard
          label="最大头"
          value={data.top[0] ? fmt(data.top[0].tokens) : '—'}
          hint={data.top[0]?.file.slice(0, 28)}
        />
      </div>
    </section>
  );
}

export default function Tokens() {
  const { data, err, reload } = useTokenData();
  const [gran, setGran] = useState<Granularity>('daily');
  const [sessionKey, setSessionKey] = useState<string>('all');
  const dark = useIsDark();

  // 会话过滤：全部 = 全量明细；选中会话 = 其关联 WO 的主文件/journal/交接单
  const filtered = useMemo<TokenFile[]>(() => {
    if (!data) return [];
    if (sessionKey === 'all') return data.files;
    const s = data.sessions.find((x) => x.session === sessionKey);
    if (!s) return [];
    return s.wo ? data.files.filter((f) => f.file.includes(s.wo!)) : [];
  }, [data, sessionKey]);

  const series = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filtered) {
      const k = bucketKey(f.date, gran);
      m.set(k, (m.get(k) || 0) + f.tokens);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([bucket, tokens]) => ({ bucket, tokens }));
  }, [filtered, gran]);

  const kindSlice = useMemo(() => {
    const m = new Map<string, { name: string; value: number }>();
    for (const f of filtered) {
      const cur = m.get(f.kind);
      if (cur) cur.value += f.tokens;
      else m.set(f.kind, { name: f.label, value: f.tokens });
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [filtered]);

  const totalFiltered = filtered.reduce((x, y) => x + y.tokens, 0);
  const lineColor = dark ? '#6B85FF' : '#3B5BFD';
  const axisStyle = { fill: dark ? '#8A93A6' : '#6B7280', fontSize: 11 };

  if (err) {
    return (
      <div className="state-error" role="alert">
        <Icon name="offline" size={22} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">加载失败</p>
          <p className="subtle mt-0.5 text-xs">{err}</p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" onPress={reload} aria-label="重试">
          <Icon name="refresh" size={16} />
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="flex gap-3">
          <Skeleton className="h-20 flex-1 rounded-xl" />
          <Skeleton className="h-20 flex-1 rounded-xl" />
          <Skeleton className="h-20 flex-1 rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="tok-layout">
      {/* 左：会话列表（默认全部） */}
      <aside className="tok-sessions" aria-label="会话列表">
        <p className="submenu-caption">会话</p>
        <ul className="flex flex-col gap-0.5">
          {[{ key: 'all', label: '全部', tokens: data.total, wo: null as string | null }, ...data.sessions.map((x) => ({ key: x.session, label: x.session, tokens: x.tokens, wo: x.wo }))].map((s) => (
            <li key={s.key}>
              <button className="submenu-item" data-on={sessionKey === s.key} onClick={() => setSessionKey(s.key)}>
                <span className="truncate text-[13px] font-medium">{s.label}</span>
                <span className="subtle truncate text-[11px]">
                  {s.wo ? s.wo.slice(0, 22) : '全部单据与日志'} · {fmt(s.tokens)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* 右：统计卡 + 曲线 + 饼图 */}
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap gap-3">
          <StatCard label="范围累计" value={fmt(totalFiltered)} hint={sessionKey === 'all' ? '全部' : sessionKey} />
          <StatCard label="单据数" value={String(filtered.length)} hint="文件数" />
          <StatCard
            label="最大头"
            value={filtered.length ? fmt([...filtered].sort((a, b) => b.tokens - a.tokens)[0].tokens) : '—'}
            hint={filtered.length ? [...filtered].sort((a, b) => b.tokens - a.tokens)[0].file.slice(0, 24) : undefined}
          />
        </div>

        <section className="tok-chart-card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">消费走势</h2>
            <div className="theme-seg" role="group" aria-label="粒度切换">
              {GRANS.map((g) => (
                <button key={g.key} data-on={gran === g.key} onClick={() => setGran(g.key)} aria-pressed={gran === g.key}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="tok-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={dark ? '#242B3A' : '#E7EBF2'} vertical={false} />
                <XAxis dataKey="bucket" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => fmt(v)} />
                <Tooltip
                  contentStyle={{
                    background: dark ? '#1B202A' : '#FFFFFF',
                    border: `1px solid ${dark ? '#2A3242' : '#E7EBF2'}`,
                    borderRadius: 10,
                    fontSize: 12,
                    color: dark ? '#E8ECF4' : '#1C212B',
                  }}
                  formatter={(v) => [fmt(Number(v)) + ' tokens', '估算消费']}
                />
                <Line type="monotone" dataKey="tokens" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="tok-chart-card">
            <h2 className="mb-2 text-sm font-semibold">按类别</h2>
            <div className="tok-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={kindSlice} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="80%" paddingAngle={2}>
                    {kindSlice.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={KIND_COLORS[Object.keys(KIND_COLORS).find((k) => data.kinds.find((x) => x.kind === k)?.label === entry.name) || ''] || '#7C93FF'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: dark ? '#1B202A' : '#FFFFFF',
                      border: `1px solid ${dark ? '#2A3242' : '#E7EBF2'}`,
                      borderRadius: 10,
                      fontSize: 12,
                      color: dark ? '#E8ECF4' : '#1C212B',
                    }}
                    formatter={(v, n) => [fmt(Number(v)) + ' tokens', String(n)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="tok-legend">
              {kindSlice.map((k) => {
                const meta = data.kinds.find((x) => x.label === k.name);
                return (
                  <li key={k.name}>
                    <span className="tok-dot" style={{ background: KIND_COLORS[meta?.kind || ''] || '#7C93FF' }} />
                    {k.name} · {fmt(k.value)}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="tok-chart-card">
            <h2 className="mb-2 text-sm font-semibold">最大头单据（top 8）</h2>
            <ol className="tok-top">
              {data.top.map((f) => (
                <li key={f.file + f.date}>
                  <span className="truncate text-[12px]">{f.file}</span>
                  <span className="subtle shrink-0 text-[11px]">
                    {f.label} · {f.date} · {fmt(f.tokens)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="subtle mt-2 text-[11px] leading-relaxed">{data.disclaimer}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
