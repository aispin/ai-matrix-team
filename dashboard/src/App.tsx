import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon, type IconName } from './icon';
import { ListBox, ListBoxItem, Skeleton } from '@heroui/react';
import About from './pages/About';
import Artifacts from './pages/Artifacts';
import Pipeline from './pages/Pipeline';
import Reports from './pages/Reports';
import Tokens from './pages/Tokens';
import type { ReportDetail, ReportListItem } from './types';

type Tab = 'pipeline' | 'reports' | 'artifacts' | 'tokens' | 'about';
type ThemeMode = 'system' | 'light' | 'dark';
type ViewMode = 'svg' | 'md';

const TABS: { key: Tab; label: string; hint: string; icon: IconName }[] = [
  { key: 'pipeline', label: '管线', hint: '谁在干什么', icon: 'pipeline' },
  { key: 'reports', label: '汇报', hint: '历史汇报', icon: 'reports' },
  { key: 'artifacts', label: '产物', hint: 'BRD·PRD·设计稿', icon: 'doc' },
  { key: 'tokens', label: '词元', hint: 'token 消费统计', icon: 'token' },
  { key: 'about', label: '关于', hint: '能力与成员', icon: 'users' },
];

const THEMES: { key: ThemeMode; label: string; icon: IconName }[] = [
  { key: 'system', label: '跟随系统', icon: 'display' },
  { key: 'light', label: '浅色', icon: 'sun' },
  { key: 'dark', label: '深色', icon: 'moon' },
];

const TITLES: Record<Tab, { title: string; sub: string }> = {
  pipeline: { title: '交付管线', sub: '谁在干什么 · 哪里卡住 · 什么办结了' },
  reports: { title: '工作汇报', sub: '大白话图形版 · 历史可回看' },
  artifacts: { title: '产物清单', sub: 'BRD · PRD · TDD · 设计稿 · ADR · 规范' },
  tokens: { title: '词元', sub: 'token 消费统计 · 按天/周/月 · 按类别（字节估算口径）' },
  about: { title: '关于团队', sub: '我们能做什么 · 都有谁' },
};

const THEME_KEY = 'theme';
const THEME_COLOR: Record<'light' | 'dark', string> = { light: '#F3F5F9', dark: '#0F1218' };

/** 读记忆偏好：'light'|'dark' 为手动；其余（含 null / 'system'）视为跟随系统。 */
function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* 隐私模式等忽略 */ }
  return 'system';
}

function prefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const h = window.location.hash.replace('#', '');
    return h === 'about' || h === 'reports' || h === 'artifacts' || h === 'tokens' ? (h as Tab) : 'pipeline';
  });
  // 外观三态：跟随系统 / 浅 / 深（localStorage 记忆 + 跟随系统时监听系统变化）
  const [theme, setTheme] = useState<ThemeMode>(readTheme);
  // 汇报历史清单：状态上提到 App，供侧栏子菜单区渲染
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [selectedReport, setSelectedReport] = useState<number | null>(null);

  // 汇报查看状态（B-2：上提到 App，图/文切换与全屏控件随之进入页头）
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [reportErr, setReportErr] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('svg');
  const [fullscreen, setFullscreen] = useState(false);
  const [reportNonce, setReportNonce] = useState(0);

  useEffect(() => { window.location.hash = tab; }, [tab]);

  // 主题落地（WO-20261007-13 HeroUI v3 对接）：HeroUI 变体走 .dark class（v3 styles
  // 同时支持 data-theme="dark"，两者同步挂摘互为冗余），项目自有令牌继续走
  // data-theme/@media；system 态监听系统变化同步（HeroUI 组件不响应 @media）。
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
      if (theme === 'system') delete root.dataset.theme;
      else root.dataset.theme = theme;
      root.classList.toggle('dark', resolved === 'dark');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);
    };
    apply();
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* 忽略 */ }

    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    api
      .reports()
      .then((items) => {
        setReports(items);
        setSelectedReport((cur) => cur ?? items[0]?.id ?? null); // 默认选最新
      })
      .catch(() => setReports([]));
  }, []);

  // 汇报详情拉取（选中变更或手动重试时；B-2 上提）
  useEffect(() => {
    if (selectedReport == null) {
      setDetail(null);
      setReportErr(null);
      setFullscreen(false);
      return;
    }
    setDetail(null);
    setReportErr(null);
    setFullscreen(false);
    api
      .report(selectedReport)
      .then(setDetail)
      .catch((e) => setReportErr(e.message));
  }, [selectedReport, reportNonce]);

  const reloadReport = () => setReportNonce((n) => n + 1);

  // 老汇报没有图形版时自动落到文字版
  const showSvg = mode === 'svg' && !!detail?.svg;

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      {/* 左侧菜单栏（桌面）/ 顶栏（窄屏） */}
      <aside
        className="flex shrink-0 flex-col border-b border-hairline md:w-60 md:border-b-0 md:border-r"
        style={{ background: 'var(--surface)' }}
      >
        {/* 常驻区：品牌 + 主菜单（HeroUI v3 ListBox，WO-20261007-13） */}
        <div className="flex items-center gap-2 px-3 py-2.5 md:flex-col md:items-stretch md:gap-1 md:px-3 md:py-4">
          <div className="flex items-center gap-2.5 md:mb-3 md:px-1.5">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold tracking-[-0.01em]">AI-Matrix 专家团</div>
              <div className="subtle hidden text-xs md:block">指挥台 · 本地面板</div>
            </div>
          </div>
          <nav className="flex min-w-0 flex-1 md:flex-col">
            <ListBox
              aria-label="主导航"
              selectionMode="single"
              selectedKeys={[tab]}
              onSelectionChange={(keys) => {
                const k = [...keys][0];
                if (k) setTab(k as Tab);
              }}
              onAction={(k) => setTab(k as Tab)}
              className="flex w-full flex-1 flex-row gap-1.5 md:flex-col md:gap-1"
            >
              {TABS.map((t) => (
                <ListBoxItem
                  key={t.key}
                  id={t.key}
                  textValue={t.label}
                  className="nav-item flex min-h-9 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors"
                >
                  <Icon name={t.icon} size={18} />
                  <span className="font-medium">{t.label}</span>
                </ListBoxItem>
              ))}
            </ListBox>
          </nav>
        </div>

        {/* 子菜单区：当前菜单的二级列表，撑满剩余高度，内容可滚动 */}
        {tab === 'reports' && (
          <div className="submenu-area">
            <p className="submenu-caption">汇报历史</p>
            {!reports && (
              <div className="flex flex-col gap-2 px-2 py-1">
                <Skeleton className="h-7 rounded-lg" />
                <Skeleton className="h-7 rounded-lg" />
              </div>
            )}
            {reports && reports.length === 0 && (
              <p className="subtle px-2 py-1 text-xs leading-relaxed">
                还没有汇报。对PC说「汇报工作进展」就会生成第一份。
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {reports?.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedReport(r.id)}
                    className="submenu-item"
                    data-on={selectedReport === r.id}
                  >
                    <span className="truncate text-[13px] font-medium">{r.title}</span>
                    <span className="subtle truncate text-[11px]">
                      {new Date(r.created_at).toLocaleString('zh-CN', { hour12: false })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 底部：外观三态切换（窄屏侧栏折成顶栏后此区仍在，主题切换始终可达） */}
        <div className="side-foot">
          <div className="theme-row">
            <span>外观</span>
            <div className="theme-seg" role="group" aria-label="外观主题">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  data-on={theme === t.key}
                  onClick={() => setTheme(t.key)}
                  title={t.label}
                  aria-label={t.label}
                  aria-pressed={theme === t.key}
                >
                  <Icon name={t.icon} size={15} />
                </button>
              ))}
            </div>
          </div>
          <p className="subtle hidden text-[11px] leading-relaxed md:block">
            数据来源：.skills/runtime 台账（唯一真相源）· 汇报库 dashboard.db
          </p>
        </div>
      </aside>

      {/* 右侧主内容区 */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={(tab === 'pipeline' ? 'flex h-full flex-col ' : '') + 'px-4 pt-0 pb-5 md:px-6 md:pb-6 lg:px-8'}>
          <header className="page-header sticky top-0 z-20 -mx-4 mb-4 flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">{TITLES[tab].title}</h1>
              <p className="subtle mt-0.5 text-sm">{TITLES[tab].sub}</p>
            </div>
            {tab === 'reports' && (
              <div className="view-toggle" role="group" aria-label="展示模式切换">
                <button data-on={showSvg} onClick={() => setMode('svg')} disabled={!detail?.svg} title="图形版" aria-label="图形版">
                  <Icon name="image" size={16} />
                </button>
                <button data-on={!showSvg} onClick={() => setMode('md')} disabled={!detail} title="文字版" aria-label="文字版">
                  <Icon name="doc" size={16} />
                </button>
                {showSvg && (
                  <button data-on={fullscreen} onClick={() => setFullscreen(true)} title="全屏查看（点击图片也可）" aria-label="全屏查看">
                    <Icon name="expand" size={16} />
                  </button>
                )}
              </div>
            )}
          </header>
          {tab === 'pipeline' && <Pipeline />}
          {tab === 'reports' && (
            <Reports
              selectedId={selectedReport}
              detail={detail}
              reportErr={reportErr}
              mode={mode}
              fullscreen={fullscreen}
              setFullscreen={setFullscreen}
              reload={reloadReport}
            />
          )}
          {tab === 'artifacts' && <Artifacts />}
          {tab === 'tokens' && <Tokens />}
          {tab === 'about' && <About />}
        </div>
      </main>
    </div>
  );
}
