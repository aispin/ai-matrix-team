#!/usr/bin/env node
// aimatrix-render · 产物外置渲染：模型只写 JSON 草稿，HTML/CSS/SVG/状态样板由本脚本生成。
// 令牌与主题机制与 aimatrix-product-designer/examples/ 同源（设计系统真相源）。
//
// 用法：
// node aimatrix-render.mjs --in <draft.json> --out <page.html> # 渲染
// node aimatrix-render.mjs --in <draft.json> --stats # 只度量（草稿 vs 产物 vs 手写基线）
//
// 草稿 schema（全部字段除 app/pages 外可省）见 references/design-draft-spec.md

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAM_REPO = path.resolve(__dirname, '..');
const EXAMPLES_DIR = path.join(TEAM_REPO, 'aimatrix-product-designer', 'examples');

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(name);

const inPath = arg('--in');
if (!inPath) {
  console.error('用法：node aimatrix-render.mjs --in <draft.json> [--out <page.html>] [--stats]');
  process.exit(2);
}

let draft;
try {
  draft = JSON.parse(fs.readFileSync(inPath, 'utf8'));
} catch (e) {
  console.error(`✗ 草稿不是合法 JSON：${e.message}`);
  process.exit(2);
}
if (!draft.app || !Array.isArray(draft.pages) || !draft.pages.length) {
  console.error('✗ 草稿缺 app 或 pages（至少一页）');
  process.exit(2);
}

// ---------------------------------------------------------------- 设计令牌（与 examples 同源）

const TOKENS = `:root{
  color-scheme:light;
  --n-0:#fff;--n-50:#f8f9fb;--n-100:#f1f3f7;--n-200:#e4e7ee;--n-300:#cdd2dd;
  --n-400:#9aa2b1;--n-500:#6b7280;--n-600:#4a5262;--n-700:#333a48;--n-800:#1f2530;--n-900:#12161d;
  --brand:#3b5bfd;--brand-h:#2f4ce0;--brand-bg:#eef1ff;
  --ok:#12855f;--ok-bg:#e6f6f0;--err:#c0392b;--err-bg:#fdecea;--warn:#a86a00;--warn-bg:#fff4e0;
  --sh-sm:0 1px 2px rgba(18,22,29,.05);
  --sh-md:0 1px 2px rgba(18,22,29,.04),0 2px 8px rgba(18,22,29,.06);
  --topbar-bg:rgba(248,249,251,.85);
}
[data-theme="dark"]{
  color-scheme:dark;
  --n-0:#1a1f28;--n-50:#0f1319;--n-100:#232a35;--n-200:#2d3542;--n-300:#3a4351;
  --n-400:#6b7280;--n-500:#9aa2b1;--n-600:#b8bfcc;--n-700:#cdd2dd;--n-800:#e4e7ee;--n-900:#f1f3f7;
  --brand:#6b85ff;--brand-h:#8499ff;--brand-bg:rgba(107,133,255,.14);
  --ok:#34d399;--ok-bg:rgba(52,211,153,.14);
  --err:#f87171;--err-bg:rgba(248,113,113,.14);
  --warn:#fbbf24;--warn-bg:rgba(251,191,36,.14);
  --sh-sm:0 1px 2px rgba(0,0,0,.4);
  --sh-md:0 1px 2px rgba(0,0,0,.3),0 2px 8px rgba(0,0,0,.35);
  --topbar-bg:rgba(15,19,25,.85);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){color-scheme:dark;
    --n-0:#1a1f28;--n-50:#0f1319;--n-100:#232a35;--n-200:#2d3542;--n-300:#3a4351;
    --n-400:#6b7280;--n-500:#9aa2b1;--n-600:#b8bfcc;--n-700:#cdd2dd;--n-800:#e4e7ee;--n-900:#f1f3f7;
    --brand:#6b85ff;--brand-h:#8499ff;--brand-bg:rgba(107,133,255,.14);
    --ok:#34d399;--ok-bg:rgba(52,211,153,.14);--err:#f87171;--err-bg:rgba(248,113,113,.14);
    --warn:#fbbf24;--warn-bg:rgba(251,191,36,.14);
    --sh-sm:0 1px 2px rgba(0,0,0,.4);--sh-md:0 1px 2px rgba(0,0,0,.3),0 2px 8px rgba(0,0,0,.35);
    --topbar-bg:rgba(15,19,25,.85);}
}`;

const CSS = `
*{box-sizing:border-box}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--n-50);color:var(--n-800);line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;font-size:14px;transition:background-color .18s,color .18s}
a{color:inherit;text-decoration:none}
:focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:4px}
button{font:inherit;cursor:pointer;color:inherit}
a{color:var(--brand);text-decoration:none}
.app{display:grid;grid-template-columns:232px 1fr;min-height:100vh}
html[data-side="1"] .app{grid-template-columns:64px 1fr}
html[data-side="2"] .app{grid-template-columns:1fr}
.side{background:var(--n-0);border-right:1px solid var(--n-200);padding:20px 12px;display:flex;flex-direction:column;gap:4px;position:sticky;top:0;height:100vh;transition:background-color .18s,border-color .18s}
html[data-side="1"] .side{padding:20px 10px}
html[data-side="2"] .side{display:none}
.brand{display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;color:var(--n-900);padding:8px 12px;margin-bottom:16px}
.brand svg{color:var(--brand);flex-shrink:0}
html[data-side="1"] .brand{justify-content:center;padding:8px 0}
html[data-side="1"] .brand .txt,html[data-side="1"] .nav-label,html[data-side="1"] .nav-item .txt,html[data-side="1"] .user-meta{display:none}
.nav-label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--n-400);padding:12px 12px 6px}
.nav-item{display:flex;align-items:center;gap:10px;height:36px;padding:0 12px;border-radius:8px;color:var(--n-600);font-size:13.5px;transition:background .12s,color .12s;cursor:pointer}
.nav-item svg{flex-shrink:0;opacity:.75}
.nav-item:hover{background:var(--n-100);color:var(--n-900)}
.nav-item.active{background:var(--brand-bg);color:var(--brand);font-weight:500}
.nav-item.active svg{opacity:1}
html[data-side="1"] .nav-item{justify-content:center;padding:0}
.side-foot{margin-top:auto;padding-top:16px;border-top:1px solid var(--n-200)}
html[data-side="1"] .side-foot{border-top:0}
.user{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px}
html[data-side="1"] .user{justify-content:center;padding:8px 0}
.avatar{width:28px;height:28px;border-radius:50%;background:var(--brand);color:var(--n-50);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0}
[data-theme="dark"] .avatar{color:#0f1319}
.user-meta{font-size:12.5px;line-height:1.3;overflow:hidden}
.user-meta b{display:block;font-weight:500;color:var(--n-800)}
.user-meta span{color:var(--n-400);font-size:11.5px}
.main{min-width:0;display:flex;flex-direction:column}
.topbar{position:sticky;top:0;z-index:5;background:var(--topbar-bg);backdrop-filter:blur(10px);border-bottom:1px solid var(--n-200);padding:0 28px;height:60px;display:flex;align-items:center;gap:16px;transition:background-color .18s,border-color .18s}
.topbar h1{font-size:16px;font-weight:600;margin:0;color:var(--n-900);letter-spacing:-.01em}
.seg{display:flex;background:var(--n-100);border-radius:8px;padding:2px;margin-left:auto}
.seg button{border:0;background:transparent;padding:6px 14px;border-radius:6px;font-size:13px;color:var(--n-500);transition:all .15s}
.seg button.on{background:var(--n-0);color:var(--n-900);box-shadow:var(--sh-sm);font-weight:500}
.seg button:hover:not(.on){color:var(--n-800)}
.theme-toggle,.side-toggle{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--n-500);border:1px solid var(--n-200);background:var(--n-0);cursor:pointer;transition:all .15s;flex-shrink:0}
.theme-toggle:hover,.side-toggle:hover{color:var(--n-900);border-color:var(--n-300)}
.side-toggle svg{transition:transform .18s}
html[data-side="1"] .side-toggle svg,html[data-side="2"] .side-toggle svg{transform:rotate(180deg)}
html[data-side="1"] .side-toggle{color:var(--brand);border-color:var(--brand)}
.theme-toggle .sun{display:none}
[data-theme="dark"] .theme-toggle .sun{display:block}
[data-theme="dark"] .theme-toggle .moon{display:none}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .theme-toggle .sun{display:block}
  :root:not([data-theme="light"]) .theme-toggle .moon{display:none}
}
.side-restore{display:none;position:fixed;left:12px;top:14px;z-index:30;width:32px;height:32px;border-radius:8px;border:1px solid var(--n-200);background:var(--n-0);color:var(--n-500);cursor:pointer;align-items:center;justify-content:center}
html[data-side="2"] .side-restore{display:flex}
.content{padding:24px 28px 48px;display:flex;flex-direction:column;gap:20px;width:100%}
.page{display:none}
.page.active{display:flex;flex-direction:column;gap:20px}
/* 状态走查：设计稿专用控件，悬浮右下，不占页面框架（与 examples 框架保持一致） */
.walk{position:fixed;right:18px;bottom:18px;z-index:40}
.walk-btn{border:1px solid var(--n-200);background:var(--n-0);color:var(--n-600);border-radius:999px;padding:7px 14px;box-shadow:var(--sh-md);cursor:pointer;font:inherit;font-size:12.5px;display:inline-flex;align-items:center;gap:7px}
.walk-btn:hover{color:var(--n-900);border-color:var(--n-300)}
.walk-panel{display:none;position:absolute;right:0;bottom:44px;background:var(--n-0);border:1px solid var(--n-200);border-radius:12px;box-shadow:var(--sh-md);padding:10px;width:220px}
.walk.open .walk-panel{display:block}
.walk-panel .walk-label{display:block;font-size:11px;color:var(--n-400);padding:2px 6px 8px}
.walk-panel button{display:block;width:100%;text-align:left;border:0;background:none;font:inherit;font-size:12.5px;color:var(--n-600);padding:7px 9px;border-radius:7px;cursor:pointer}
.walk-panel button:hover{background:var(--n-100);color:var(--n-900)}
.walk-panel button.active{background:var(--brand-bg);color:var(--brand);font-weight:600}
.panel{background:var(--n-0);border:1px solid var(--n-200);border-radius:12px;overflow:hidden}
.panel-head{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--n-200)}
.panel-head h2{font-size:14px;margin:0;flex:1;font-weight:600;letter-spacing:-.01em}
.hint{color:var(--n-400);font-size:12.5px}
.panel-body{padding:16px}
.grid{display:grid;gap:14px}
.cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.stat{background:var(--n-0);border:1px solid var(--n-200);border-radius:12px;padding:14px}
.stat .k{color:var(--n-500);font-size:12.5px}
.stat .v{font-size:24px;font-weight:650;margin:6px 0 2px;letter-spacing:-.01em}
.stat .d{font-size:12.5px;color:var(--n-500)}
.tone-ok{color:var(--ok)}.tone-err{color:var(--err)}.tone-warn{color:var(--warn)}
.card{border:1px solid var(--n-200);border-radius:12px;padding:14px;background:var(--n-0)}
.card h3{margin:0 0 6px;font-size:13.5px}
.card p{margin:0;color:var(--n-600);font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--n-500);font-weight:600;padding:9px 12px;border-bottom:1px solid var(--n-200);white-space:nowrap}
td{padding:10px 12px;border-bottom:1px solid var(--n-100);vertical-align:middle}
tbody tr:last-child td{border-bottom:0}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.tag{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 9px;font-size:12px;background:var(--n-100);color:var(--n-600)}
.tag i{width:6px;height:6px;border-radius:50%;background:currentColor}
.tag.ok{background:var(--ok-bg);color:var(--ok)}
.tag.err{background:var(--err-bg);color:var(--err)}
.tag.warn{background:var(--warn-bg);color:var(--warn)}
.cell-long{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.field{margin-bottom:12px}
.field label{display:block;font-size:12.5px;color:var(--n-600);margin-bottom:5px}
.field input,.field select,.field textarea{width:100%;padding:9px 11px;border:1px solid var(--n-200);border-radius:9px;background:var(--n-0);color:var(--n-900);font:inherit;font-size:13px}
.row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
.btn{border:0;border-radius:9px;padding:9px 15px;background:var(--brand);color:#fff;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.btn.ghost{background:var(--n-0);color:var(--n-700);border:1px solid var(--n-200)}
.chat{display:flex;flex-direction:column;gap:10px}
.msg{max-width:78%;padding:10px 13px;border-radius:13px;font-size:13px}
.msg.user{align-self:flex-end;background:var(--brand);color:#fff;border-bottom-right-radius:4px}
.msg.agent{align-self:flex-start;background:var(--n-100);border-bottom-left-radius:4px}
.msg .meta{display:block;font-size:11.5px;opacity:.75;margin-bottom:4px}
.notice{display:flex;gap:10px;align-items:flex-start;border-radius:11px;padding:12px 14px;font-size:13px;background:var(--n-100);color:var(--n-700)}
.notice.warn{background:var(--warn-bg);color:var(--warn)}
.notice.err{background:var(--err-bg);color:var(--err)}
.notice.ok{background:var(--ok-bg);color:var(--ok)}
.kv{display:grid;grid-template-columns:120px 1fr;gap:8px 14px;font-size:13px}
.kv dt{color:var(--n-500)}
.kv dd{margin:0}
.list{list-style:none;padding:0;margin:0}
.list li{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--n-100)}
.list li:last-child{border-bottom:0}
.tabs .tabbar{display:flex;gap:4px;border-bottom:1px solid var(--n-200);margin-bottom:14px;flex-wrap:wrap}
.tabs .tab{border:0;background:none;padding:8px 12px;font:inherit;font-size:13px;color:var(--n-500);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs .tab:hover{color:var(--n-800)}
.tabs .tab.active{color:var(--brand);border-bottom-color:var(--brand);font-weight:600}
.tabs .tabpanel{display:none}
.tabs .tabpanel.active{display:block}
.tabs .tabtext{margin:0 0 10px;color:var(--n-600);font-size:13px}
.tabs .tabpanel .tabs{margin-top:10px}
.empty{text-align:center;padding:34px 16px;color:var(--n-500)}
.empty .ic{width:44px;height:44px;border-radius:12px;background:var(--n-100);display:grid;place-items:center;margin:0 auto 10px}
.skel{height:12px;border-radius:6px;background:linear-gradient(90deg,var(--n-100) 25%,var(--n-200) 37%,var(--n-100) 63%);background-size:400% 100%;animation:sk 1.3s ease-in-out infinite}
.skel.row{height:38px;margin-bottom:8px}
@keyframes sk{0%{background-position:100% 50%}100%{background-position:0 50%}}
.state-note{font-size:12.5px;color:var(--n-400);padding:2px}
/* ---- 营销版式（landing 场景 · layout:"marketing"） ---- */
[data-layout="marketing"] .app{grid-template-columns:1fr}
[data-layout="marketing"] .side{display:none}
[data-layout="marketing"] .side-toggle,[data-layout="marketing"] .side-restore{display:none !important}
[data-layout="marketing"] .content{padding:0 28px 56px;max-width:1080px;margin:0 auto}
.hero{text-align:center;padding:72px 0 48px}
.hero .eyebrow{display:inline-block;border:1px solid var(--n-200);background:var(--n-0);color:var(--n-600);border-radius:999px;padding:4px 12px;font-size:12.5px;margin-bottom:18px}
.hero h1{margin:0 0 14px;font-size:40px;line-height:1.22;letter-spacing:-.02em;font-weight:680}
.hero h1 .accent{color:var(--brand)}
.hero .sub{margin:0 auto;max-width:620px;color:var(--n-600);font-size:15px;line-height:1.7}
.hero .ctas{display:flex;gap:10px;justify-content:center;margin-top:24px;flex-wrap:wrap}
.hero .meta{display:flex;gap:18px;justify-content:center;margin-top:22px;color:var(--n-500);font-size:12.5px;flex-wrap:wrap}
.btn.lg{padding:11px 20px;font-size:13.5px}
.feature-grid{display:grid;gap:16px}
.feature{border:1px solid var(--n-200);border-radius:14px;background:var(--n-0);padding:18px}
.feature .fic{width:34px;height:34px;border-radius:10px;background:var(--brand-bg);color:var(--brand);display:grid;place-items:center;margin-bottom:12px}
.feature h3{margin:0 0 6px;font-size:14px}
.feature p{margin:0;color:var(--n-600);font-size:13px;line-height:1.65}
.sec-head{text-align:center;margin:40px 0 20px}
.sec-head h2{margin:0 0 8px;font-size:24px;letter-spacing:-.01em}
.sec-head p{margin:0;color:var(--n-500);font-size:13.5px}
.compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.compare{border:1px solid var(--n-200);border-radius:14px;padding:18px;background:var(--n-0)}
.compare.after{border-color:var(--brand);background:var(--brand-bg)}
.compare h3{margin:0 0 10px;font-size:14px}
.compare.before h3{color:var(--n-500)}
.compare ul{list-style:none;margin:0;padding:0}
.compare li{display:flex;gap:9px;align-items:flex-start;padding:7px 0;font-size:13px;color:var(--n-700)}
.compare li svg{flex:0 0 16px;margin-top:2px;color:var(--n-400)}
.compare.after li svg{color:var(--brand)}
.cta-band{text-align:center;border:1px solid var(--n-200);border-radius:16px;background:var(--n-0);padding:34px 20px;margin-top:44px}
.cta-band h2{margin:0 0 8px;font-size:22px}
.cta-band p{margin:0 0 18px;color:var(--n-500);font-size:13.5px}
.content[data-state="default"] .only-state{display:none}
.content:not([data-state="default"]) .only-default{display:none}
[data-state="loading"] .s-loading,[data-state="empty"] .s-empty,[data-state="error"] .s-error,[data-state="forbidden"] .s-forbidden,[data-state="offline"] .s-offline,[data-state="partial"] .s-partial,[data-state="overflow"] .s-overflow{display:block}
.s-loading,.s-empty,.s-error,.s-forbidden,.s-offline,.s-partial,.s-overflow{display:none}
@media (max-width:760px){
  .cols-2,.cols-3,.cols-4{grid-template-columns:1fr}
  .content{padding:14px}
  .side{position:fixed;z-index:25;height:100%;box-shadow:var(--sh-md)}
}`;

// ---------------------------------------------------------------- 图标（线性 SVG，禁 emoji）

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3.5-4 3 2.5L19 8"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0111 0"/><path d="M16 5.5a3 3 0 010 5.6"/><path d="M17.5 19a5.5 5.5 0 00-2-4.3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 006.5 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 15H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 8.5l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 4.6V4a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
  bell: '<path d="M18 9a6 6 0 10-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.3 20a2 2 0 003.4 0"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><circle cx="12" cy="17.2" r=".6"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.6"/><path d="M8.2 10.5V8a3.8 3.8 0 017.6 0v2.5"/>',
  wifi: '<path d="M4 9a12 12 0 0116 0"/><path d="M7 12.5a8 8 0 0110 0"/><path d="M10 16a4 4 0 014 0"/><circle cx="12" cy="19.4" r=".7"/>',
  refresh: '<path d="M20 12a8 8 0 10-2.6 5.9"/><path d="M20 6v6h-6"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  inbox: '<path d="M4 13l2-8h12l2 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  side: '<rect x="3.5" y="4" width="17" height="16" rx="2.6"/><path d="M9.5 4v16"/>',
};

const svg = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.grid}</svg>`;
// 需要按类名切换显隐的图标（主题 sun/moon）
const svg2 = (name, size = 18) => svg(name, size).replace('<svg ', `<svg class="${name}" `);

// ---------------------------------------------------------------- 组件渲染

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// 组件表达不了的 section 一律记错：渲染器只覆盖固定词汇，覆盖不了要显式告知（走手写路径或补组件），不许静默产出残缺页
const renderErrors = [];
const rawCount = { n: 0 };
const uiAttr = (s) => (s.ui ? ` data-ui="${esc(s.ui)}"` : '');
const stateCopy = (draft, s, key, fallback) => draft.stateCopy?.[key] ?? s.stateCopy?.[key] ?? fallback;

const STATES = [
  ['default', '默认'], ['loading', '加载中'], ['empty', '空态'], ['error', '错误'],
  ['forbidden', '无权限'], ['offline', '离线'], ['partial', '部分失败'], ['overflow', '超长内容'],
];

function skeleton(n = 4) {
  return Array.from({ length: n }, () => '<div class="skel row"></div>').join('');
}

function sectionBody(s, state, draft) {
  const t = s.type;
  if (state === 'loading') return `<div class="s-loading">${skeleton(t === 'table' ? 5 : 3)}</div>`;
  if (state === 'empty') {
    return `<div class="only-state s-empty"><div class="empty"><div class="ic">${svg(s.icon || 'inbox', 20)}</div><p>${esc(stateCopy(draft, s, 'empty', '暂无数据'))}</p>${s.emptyAction ? `<button class="btn">${esc(s.emptyAction)}</button>` : ''}</div></div>`;
  }
  if (state === 'error') {
    return `<div class="only-state s-error"><div class="notice err">${svg('alert', 16)}<span>${esc(stateCopy(draft, s, 'error', '加载失败，请重试'))}</span></div><p style="margin:12px 0 0"><button class="btn ghost">${svg('refresh', 14)} 重试</button></p></div>`;
  }
  if (state === 'forbidden') {
    return `<div class="only-state s-forbidden"><div class="empty"><div class="ic">${svg('lock', 20)}</div><p>${esc(stateCopy(draft, s, 'forbidden', '你没有权限查看该内容'))}</p><p class="hint">如需访问请联系管理员</p></div></div>`;
  }
  if (state === 'offline') {
    return `<div class="only-state s-offline"><div class="notice warn">${svg('wifi', 16)}<span>${esc(stateCopy(draft, s, 'offline', '当前离线，展示的是本地缓存，恢复联网后自动同步'))}</span></div></div>`;
  }
  if (state === 'partial') {
    return `<div class="only-state s-partial"><div class="notice warn">${svg('alert', 16)}<span>部分数据加载失败（${esc(s.partialCount ?? '2/7')} 失败），其余可用</span></div><p style="margin:12px 0 0"><button class="btn ghost">${svg('refresh', 14)} 仅重试失败项</button></p></div>`;
  }
  if (state === 'overflow') {
    const long = '超长内容示例：这是一段刻意拉长的文案，用于验证截断、换行与滚动行为是否仍然可用。'.repeat(3);
    return `<div class="only-state s-overflow"><div class="notice">${svg('file', 16)}<span class="cell-long" title="${esc(long)}">${esc(long)}</span></div><div class="kv" style="margin-top:12px"><dt>长名称</dt><dd class="cell-long">${esc(long)}</dd></div></div>`;
  }
  return '';
}

function sectionHtml(s, draft) {
  if (s.type === 'raw' && !s.title) return (() => { rawCount.n++; return s.html || ''; })();
  // 营销区块：整块版式，不套 panel 外壳
  if (s.type === 'hero') {
    return `<section class="hero"${uiAttr(s)}>` +
      (s.eyebrow ? `<span class="eyebrow">${esc(s.eyebrow)}</span>` : '') +
      `<h1>${esc(s.title)}${s.accent ? ` <span class="accent">${esc(s.accent)}</span>` : ''}</h1>` +
      (s.sub ? `<p class="sub">${esc(s.sub)}</p>` : '') +
      (s.ctas?.length ? `<div class="ctas">${s.ctas.map((c) => `<button class="btn ${c.kind === 'ghost' ? 'ghost' : ''} lg">${esc(c.label)}</button>`).join('')}</div>` : '') +
      (s.meta?.length ? `<div class="meta">${s.meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : '') +
      `</section>`;
  }
  if (s.type === 'features') {
    const cols = Math.min(s.cols || 3, 4);
    return `<section${uiAttr(s)}>` +
      (s.title ? `<div class="sec-head"><h2>${esc(s.title)}</h2>${s.sub ? `<p>${esc(s.sub)}</p>` : ''}</div>` : '') +
      `<div class="feature-grid cols-${cols}">${(s.items || []).map((i) => `<div class="feature"><div class="fic">${svg(i.icon || 'check', 18)}</div><h3>${esc(i.title)}</h3><p>${esc(i.text || '')}</p></div>`).join('')}</div>` +
      `</section>`;
  }
  if (s.type === 'compare') {
    const col = (side, cls) => `<div class="compare ${cls}"><h3>${esc(side?.title || '')}</h3><ul>${(side?.items || []).map((it) => `<li>${svg(cls === 'after' ? 'check' : 'alert', 16)}<span>${esc(it)}</span></li>`).join('')}</ul></div>`;
    return `<section${uiAttr(s)}>` +
      (s.title ? `<div class="sec-head"><h2>${esc(s.title)}</h2></div>` : '') +
      `<div class="compare-grid">${col(s.before, 'before')}${col(s.after, 'after')}</div>` +
      `</section>`;
  }
  if (s.type === 'cta') {
    return `<section class="cta-band"${uiAttr(s)}><h2>${esc(s.title)}</h2>${s.sub ? `<p>${esc(s.sub)}</p>` : ''}<div class="ctas" style="justify-content:center;display:flex;gap:10px;flex-wrap:wrap">` +
      (s.primary ? `<button class="btn lg">${esc(s.primary)}</button>` : '') +
      (s.secondary ? `<button class="btn ghost lg">${esc(s.secondary)}</button>` : '') +
      `</div></section>`;
  }
  if (s.type === 'notice') {
    return `<div class="panel"><div class="panel-body"><div class="notice ${s.tone || ''}">${svg(s.icon || 'alert', 16)}<span>${esc(s.text)}</span></div></div></div>`;
  }
  const body = (() => {
    const t = s.type;
    switch (t) {
      case 'stats':
        return `<div class="grid cols-${Math.min((s.items || []).length, 4)}">${(s.items || []).map((i) => `<div class="stat"><div class="k">${esc(i.label)}</div><div class="v">${esc(i.value)}</div><div class="d ${i.tone ? 'tone-' + i.tone : ''}">${esc(i.delta || '')}</div></div>`).join('')}</div>`;
      case 'cards':
        return `<div class="grid cols-${Math.min(s.cols || 3, 4)}">${(s.items || []).map((i) => `<div class="card"><h3>${esc(i.title)}</h3><p>${esc(i.text || '')}</p></div>`).join('')}</div>`;
      case 'table':
        return `<table><thead><tr>${(s.columns || []).map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${(s.rows || []).map((r) => `<tr>${r.map((c) => {
          if (c && typeof c === 'object') {
            if (c.tag) return `<td><span class="tag ${c.tone || ''}"><i></i>${esc(c.tag)}</span></td>`;
            if (c.mono) return `<td class="mono">${esc(c.mono)}</td>`;
            if (c.long) return `<td><span class="cell-long" title="${esc(c.long)}">${esc(c.long)}</span></td>`;
          }
          return `<td>${esc(c)}</td>`;
        }).join('')}</tr>`).join('')}</tbody></table>`;
      case 'form':
        return `<div class="row">${(s.fields || []).map((f) => {
          const input = f.kind === 'select'
            ? `<select>${(f.options || []).map((o) => `<option>${esc(o)}</option>`).join('')}</select>`
            : f.kind === 'textarea'
              ? `<textarea rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}"></textarea>`
              : `<input type="${f.kind || 'text'}" placeholder="${esc(f.placeholder || '')}" />`;
          return `<div class="field" style="flex:1;min-width:180px"><label>${esc(f.label)}</label>${input}</div>`;
        }).join('')}<button class="btn">${esc(s.submit || '查询')}</button></div>`;
      case 'chat':
        return `<div class="chat">${(s.messages || []).map((m) => `<div class="msg ${m.role === 'user' ? 'user' : 'agent'}"><span class="meta">${esc(m.role === 'user' ? (draft.youLabel || '你') : (m.name || draft.agentLabel || 'Agent'))}</span>${esc(m.text)}</div>`).join('')}</div>`;
      case 'tabs':
        return `<div class="tabs" data-tabs>` +
          `<div class="tabbar">${(s.tabs || []).map((t, i) => `<button type="button" class="tab${i === 0 ? ' active' : ''}" data-tab="${i}">${esc(t.label)}</button>`).join('')}</div>` +
          (s.tabs || []).map((t, i) => `<div class="tabpanel${i === 0 ? ' active' : ''}" data-panel="${i}">` +
            (t.text ? `<p class="tabtext">${esc(t.text)}</p>` : '') +
            (t.items?.length ? `<ul class="list">${t.items.map((it) => `<li>${svg(it.icon || 'check', 16)}<span style="flex:1">${esc(it.text)}</span>${it.tag ? `<span class="tag ${it.tone || ''}"><i></i>${esc(it.tag)}</span>` : ''}</li>`).join('')}</ul>` : '') +
            (t.kv?.length ? `<dl class="kv">${t.kv.map((k) => `<dt>${esc(k.k)}</dt><dd>${esc(k.v)}</dd>`).join('')}</dl>` : '') +
            `</div>`).join('') +
          `</div>`;
      case 'list':
        return `<ul class="list">${(s.items || []).map((i) => `<li>${svg(i.icon || 'check', 16)}<span style="flex:1">${esc(i.text)}</span>${i.tag ? `<span class="tag ${i.tone || ''}"><i></i>${esc(i.tag)}</span>` : ''}</li>`).join('')}</ul>`;
      case 'kv':
        return `<dl class="kv">${(s.items || []).map((i) => `<dt>${esc(i.k)}</dt><dd>${esc(i.v)}</dd>`).join('')}</dl>`;
      case 'raw': {
        // 逃生舱：个别区块渲染器表达不了时局部手写（必须用设计令牌；每页建议 ≤1 处）
        rawCount.n++;
        if (!s.html) { renderErrors.push(`raw 组件缺 html（${s.title || '无名区块'}）`); return ''; }
        return `<div${uiAttr(s)} data-raw="1">${s.html}</div>`;
      }
      default:
        renderErrors.push(`未知组件类型「${t}」（${s.title || '无名区块'}）`);
        return `<div class="state-note">⚠ 渲染器不支持组件「${esc(t)}」——请补组件，或改用 \`raw\` 局部手写 / 整页手写（照 examples/）</div>`;
    }
  })();
  const note = ['table', 'cards', 'stats', 'chat', 'list'].includes(s.type) ? '' : '';
  return `<section class="panel"${uiAttr(s)}><div class="panel-head"><h2>${esc(s.title || '')}</h2>${s.hint ? `<span class="hint">${esc(s.hint)}</span>` : ''}</div><div class="panel-body"><div class="only-default">${body}</div>${sectionBody(s, 'loading', draft)}${sectionBody(s, 'empty', draft)}${sectionBody(s, 'error', draft)}${sectionBody(s, 'forbidden', draft)}${sectionBody(s, 'offline', draft)}${sectionBody(s, 'partial', draft)}${sectionBody(s, 'overflow', draft)}${note}</div></section>`;
}

function pageHtml(p, i, draft) {
  return { body: `<div class="page${i === 0 ? ' active' : ''}" data-page="${i}">${(p.sections || []).map((s) => sectionHtml(s, draft)).join('')}</div>`, title: p.title || draft.app };
}

function navHtml(draft) {
  let out = '';
  let group = null;
  (draft.nav || []).forEach((n, j) => {
    if (n.group && n.group !== group) { group = n.group; out += `<div class="nav-label">${esc(n.group)}</div>`; }
    out += `<a class="nav-item${j === 0 ? ' active' : ''}" data-page="${j}">${svg(n.icon || 'grid', 18)}<span class="txt">${esc(n.label)}</span></a>`;
  });
  return out;
}

function render() {
  const pages = draft.pages.map((p, i) => pageHtml(p, i, draft));
  return `<!DOCTYPE html>
<html lang="${esc(draft.lang || 'zh-CN')}"${draft.layout === 'marketing' ? ' data-layout="marketing"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(draft.title || draft.app + ' — 设计稿')}</title>
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>
<script>try{var s=localStorage.getItem('side-stage-${esc(draft.app)}');if(s)document.documentElement.dataset.side=s;}catch(e){}</script>
<style>${TOKENS}${CSS}</style>
</head>
<body>
<button class="side-restore" id="side-restore" title="展开侧栏" aria-label="展开侧栏">${svg('side', 15)}</button>
<div class="app">
  <aside class="side">
    <div class="brand">${svg('grid', 18)}<span class="txt">${esc(draft.app)}</span></div>
    <nav>${navHtml(draft)}</nav>
    ${draft.user ? `<div class="side-foot"><div class="user"><span class="avatar">${esc((draft.user.name || '?').slice(0, 1))}</span><span class="user-meta"><b>${esc(draft.user.name)}</b><span>${esc(draft.user.role || '')}</span></span></div></div>` : ''}
  </aside>
  <div class="main">
    <header class="topbar">
      <button class="side-toggle" id="side-toggle" title="收起侧栏" aria-label="收起侧栏">${svg('side', 15)}</button>
      <h1 id="page-title">${esc(pages[0].title)}</h1>
      ${draft.seg?.length ? `<div class="seg" id="top-seg">${draft.seg.map((s, i) => `<button${i === (draft.segActive ?? draft.seg.length - 1) ? ' class="on"' : ''}>${esc(s)}</button>`).join('')}</div>` : ''}
      <button class="theme-toggle" id="theme-toggle" title="切换主题" aria-label="切换主题"${draft.seg?.length ? '' : ' style="margin-left:auto"'}>${svg2('moon', 15)}${svg2('sun', 15)}</button>
    </header>
    <main class="content" data-state="default">
      ${pages.map((p) => p.body).join('')}
    </main>
  </div>
</div>
<div class="walk" id="walk">
  <button class="walk-btn" id="walk-btn">${svg('chart', 14)} 状态走查</button>
  <div class="walk-panel">
    <span class="walk-label">逐态走查（设计稿专用）</span>
    ${STATES.map(([k, label]) => `<button data-state="${k}"${k === 'default' ? ' class="active"' : ''}>${label}</button>`).join('')}
  </div>
</div>
<script>
(function(){
  var r=document.documentElement;
  var content=document.querySelector('.content');
  var title=document.getElementById('page-title');
  var walk=document.getElementById('walk');
  function setState(k){
    content.dataset.state=k;
    walk.querySelectorAll('.walk-panel button').forEach(function(b){b.classList.toggle('active',b.dataset.state===k)});
  }
  document.getElementById('walk-btn').addEventListener('click',function(){walk.classList.toggle('open')});
  document.querySelectorAll('.nav-item').forEach(function(a){
    a.addEventListener('click',function(){
      var i=a.dataset.page;
      document.querySelectorAll('.nav-item').forEach(function(x){x.classList.toggle('active',x===a)});
      document.querySelectorAll('.page').forEach(function(p){p.classList.toggle('active',p.dataset.page===i)});
      var lb=a.querySelector('.txt');
      title.textContent=lb?lb.textContent:a.textContent.trim();
      setState('default');
    });
  });
  walk.querySelectorAll('.walk-panel button').forEach(function(b){
    b.addEventListener('click',function(){setState(b.dataset.state);walk.classList.remove('open')});
  });
  var topSeg=document.getElementById('top-seg');
  if(topSeg) topSeg.querySelectorAll('button').forEach(function(b){
    b.addEventListener('click',function(){topSeg.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)})});
  });
  document.querySelectorAll('[data-tabs]').forEach(function(w){
    w.querySelectorAll('.tab').forEach(function(b){
      b.addEventListener('click',function(){
        var i=b.dataset.tab;
        w.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('active',x===b)});
        w.querySelectorAll('.tabpanel').forEach(function(p){p.classList.toggle('active',p.dataset.panel===i)});
      });
    });
  });
  var tb=document.getElementById('theme-toggle');
  tb.addEventListener('click',function(){
    var cur=r.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
    var next=cur==='dark'?'light':'dark';
    r.dataset.theme=next;try{localStorage.setItem('theme',next)}catch(e){}
  });
  var side=parseInt(r.dataset.side||'0',10)||0;
  var st=document.getElementById('side-toggle'), rs=document.getElementById('side-restore');
  function applySide(){
    r.dataset.side=String(side);
    try{localStorage.setItem('side-stage-${esc(draft.app)}',String(side))}catch(e){}
    var lbl=side===0?'收起侧栏':(side===1?'再点一次完全隐藏侧栏':'展开侧栏');
    st.title=lbl;st.setAttribute('aria-label',lbl);
  }
  st.addEventListener('click',function(){side=side>=2?0:side+1;applySide()});
  rs.addEventListener('click',function(){side=0;applySide()});
  applySide();
})();
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- 度量

const stats = has('--stats');
const draftBytes = Buffer.byteLength(fs.readFileSync(inPath, 'utf8'));
const html = render();
const htmlBytes = Buffer.byteLength(html);

// 覆盖不了就显式失败：不写文件、退出码 1，避免把残缺页当交付物
if (renderErrors.length) {
  console.error('✗ 草稿有渲染器表达不了的区块（未产出文件）：');
  for (const e of renderErrors) console.error('  - ' + e);
  console.error('  处置：① 换成本表支持的组件；② 该区块用 `raw` 局部手写（仍用设计令牌）；③ 整页照 examples/ 手写。');
  process.exit(1);
}

if (stats) {
  let ex = [];
  try {
    ex = fs.readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.html')).map((f) => fs.statSync(path.join(EXAMPLES_DIR, f)).size);
  } catch {}
  const avg = ex.length ? Math.round(ex.reduce((a, b) => a + b, 0) / ex.length) : 0;
  console.log('== 产物 token 面（模型侧 vs 工具侧）==');
  console.log(`  草稿（模型写）    ${draftBytes} B`);
  console.log(`  渲染产物（工具写）${htmlBytes} B`);
  console.log(`  手写基线（examples 均值）${avg} B`);
  if (avg) console.log(`  模型侧输出降幅   ${(100 - (draftBytes / avg) * 100).toFixed(1)}%（草稿/手写 = ${(draftBytes / avg * 100).toFixed(1)}%）`);
  process.exit(0);
}

const outPath = arg('--out');
if (!outPath) {
  console.error('缺 --out <page.html>（或用 --stats 只度量）');
  process.exit(2);
}
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`✓ 渲染完成：${outPath}（草稿 ${draftBytes} B → 产物 ${htmlBytes} B，放大 ${(htmlBytes / draftBytes).toFixed(1)}×）`);
