import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../icon';
import { Markdown } from '../markdown';
import { Avatar, Button, Card, Chip, Modal, useOverlayState } from '@heroui/react';
import { api } from '../api';
import type { Pipeline as PipelineData } from '../types';

type DrawerTarget = { kind: 'wo' | 'dr'; id: string } | null;

/** 批复推荐选项：渲染为可勾选 chips；「其他」口径走补充说明输入框。 */
const VERDICT_OPTIONS = ['同意 · 按推荐方案推进', '按默认方案', '打回重议'];

/** 锁摘要文案（schema 2 面域分片 / legacy 单持 / 空闲三态，消费方须形状判别）。 */
function lockChipText(lock: PipelineData['lock']): string {
  if (!lock) return '公共区空闲';
  if ('holders' in lock) {
    if (lock.holders.length === 0) return '公共区空闲';
    return `${lock.count} 张${lock.holders.map((h) => h.wo.replace(/^WO-\d{8}-/, '')).join('、')}占锁`;
  }
  return `1 张（legacy）占锁`;
}

export default function Pipeline() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // 泳道联动：选中的成员 id
  const [sel, setSel] = useState<string | null>(null);
  // 台账原文抽屉
  const [drawer, setDrawer] = useState<DrawerTarget>(null);
  // 归档单删除确认（HeroUI v3 Modal + useOverlayState）
  const [confirm, setConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirmState = useOverlayState({
    isOpen: !!confirm,
    onOpenChange: (o) => { if (!o) setConfirm(null); },
  });

  const load = useCallback(() => {
    api.pipeline().then(setData).catch((e) => setErr(e.message));
  }, []);

  useEffect(load, [load]);

  // 抽屉文档拉取
  const [doc, setDoc] = useState<{ id: string; content_md: string } | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false); // 单据 ID 复制反馈
  const [verdict, setVerdict] = useState<{ choices: string[]; note: string }>({ choices: [], note: '' }); // DR 批复回填表单
  const [vBusy, setVBusy] = useState(false);
  const [vMsg, setVMsg] = useState<string | null>(null);

  useEffect(() => {
    setDoc(null);
    setDocErr(null);
    setCopied(false);
    setVerdict({ choices: [], note: '' });
    setVMsg(null);
    if (!drawer) return;
    const fetchDoc = drawer.kind === 'wo' ? api.workorderDoc(drawer.id) : api.decisionDoc(drawer.id);
    fetchDoc.then(setDoc).catch((e) => setDocErr(e.message));
  }, [drawer]);

  // Esc 关闭抽屉
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  // 单据 ID 快捷复制
  const copyId = async () => {
    if (!drawer) return;
    try {
      await navigator.clipboard.writeText(drawer.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* 剪贴板不可达时静默 */ }
  };

  // DR 批复回填：勾选推荐选项 + 补充说明 → 回写单据「答复」字段
  const submitVerdict = async () => {
    if (!drawer || drawer.kind !== 'dr') return;
    if (!verdict.choices.length && !verdict.note.trim()) {
      setVMsg('请先勾选结论，或填写补充说明');
      return;
    }
    setVBusy(true);
    setVMsg(null);
    try {
      const r = await api.decisionVerdict(drawer.id, verdict.choices, verdict.note);
      setDoc({ id: drawer.id, content_md: r.content_md });
      setVerdict({ choices: [], note: '' });
      setVMsg('已回填批复 ✓（单据状态流转仍由提出者走 ledger-sync 收口）');
    } catch (e) {
      setVMsg(`提交失败：${(e as Error).message}`);
    } finally {
      setVBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.deleteClosedWorkorder(confirm);
      setConfirm(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
      setConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  if (err) return (<div className="state-error" role="alert"><Icon name="offline" size={22} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">加载失败</p><p className="subtle mt-0.5 text-xs">{err}（服务端起了吗？node .skills/dashboard/server/server.mjs）</p></div><Button variant="ghost" size="sm" className="shrink-0" onPress={() => { setErr(null); load(); }} aria-label="重试"><Icon name="refresh" size={16} /></Button></div>);
  if (!data) return <div className="subtle p-6 text-sm">加载中…</div>;

  const working = data.members.filter((m) => m.working).length;
  const openDr = data.decisions.open;

  // 泳道联动：选中成员后，在办/办结两泳道按 executor（花名或角色）高亮命中、淡化未命中。
  // 待拍板（DR）无执行人字段，不做伪联动。
  const selMember = sel ? data.members.find((m) => m.id === sel) || null : null;
  const laneStyle = (executor?: string) => {
    if (!selMember) return {};
    const isHit = executor === selMember.name || executor === selMember.role;
    return isHit ? { outline: '2px solid var(--accent)', outlineOffset: '-1px' } : { opacity: 0.35 };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* 状态摘要条（HeroUI v3 Chip：color=accent/danger/default/success/warning） */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
        <Chip size="sm" variant="soft" color={working ? 'success' : 'default'}><i className="dot" aria-hidden />{working ? `${working} 人施工中` : '全员待命'}</Chip>
        <Chip size="sm" variant="tertiary">{lockChipText(data.lock)}</Chip>
        <Chip size="sm" variant="tertiary">{data.activeWorkorders.length} 张在办{data.terms.wo}</Chip>
        {openDr.length > 0
          ? <Chip size="sm" variant="soft" color="danger"><i className="dot" aria-hidden />{openDr.length} 件{data.terms.dr}等您</Chip>
          : <Chip size="sm" variant="soft" color="success"><i className="dot" aria-hidden />无待拍板事项</Chip>}
        {data.inspection && <Chip size="sm" variant="soft" color="warning"><i className="dot" aria-hidden />最近体检：{data.inspection.summary}</Chip>}
        {selMember && <Chip size="sm" variant="soft" color="accent">已选 {selMember.name} · 相关条目已高亮</Chip>}
      </div>

      {/* 响应式泳道：大屏四列等高撑满视窗（头固定 / 体滚动），小屏纵向自然堆叠 */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-4 lg:items-stretch">
        {/* 泳道 1：团队成员（HeroUI v3 Card + Avatar） */}
        <Card className="card flex min-h-0 flex-col p-4">
          <h2 className="section-title mb-3 shrink-0">团队成员（{data.members.length}）</h2>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {data.members.map((m) => (
              <div
                key={m.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2"
                style={{ background: sel === m.id ? 'var(--accent-soft)' : 'var(--surface-2)', outline: sel === m.id ? '2px solid var(--accent)' : 'none', outlineOffset: '-1px' }}
                onClick={() => setSel((cur) => (cur === m.id ? null : m.id))}
                title={`${m.desc}（点击联动查看相关单据，再点一次取消）`}
              >
                <Avatar
                  size="sm"
                  className="shrink-0 text-sm font-bold"
                  style={{ background: m.color, color: '#fff' }}
                >
                  {m.name[0]}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 text-xs">
                    <span className="font-semibold">{m.name}</span>
                    <span className="subtle font-normal">{m.role}</span>
                  </div>
                  <div className="subtle mt-0.5 text-[11px] leading-relaxed">
                    {/* 多实例（DR-20261005-003）：同角色多个呼号分行展示，各行带会话归属 */}
                    {(m.busyList?.length ? m.busyList : [m.busy || '空闲，待派活']).map((b, i) => (
                      <div key={i} className="truncate">{b}</div>
                    ))}
                  </div>
                </div>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: m.working ? 'var(--ok)' : 'var(--border)' }}
                  title={m.working ? '施工中' : '空闲'}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* 泳道 2：在办工单 */}
        <Card className="card flex min-h-0 flex-col p-4">
          <h2 className="section-title mb-3 shrink-0">在办的{data.terms.wo}（{data.activeWorkorders.length}）</h2>
          {data.activeWorkorders.length === 0 && <p className="subtle shrink-0 text-sm">没有在办单。有活随时吩咐。</p>}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {data.activeWorkorders.map((w) => (
              <div
                key={w.id}
                className="ledger-item cursor-pointer rounded-lg p-2.5"
                style={{ background: 'var(--surface-2)', ...laneStyle(w.executor) }}
                onClick={() => setDrawer({ kind: 'wo', id: w.id })}
                title="点击查看工单原文"
              >
                <div className="flex items-center text-xs font-medium">
                  {w.id}
                  {w.callsign && (
                    <Chip size="sm" variant="tertiary" className="ml-1.5 min-w-0 !px-1.5 !py-0 !text-[10px]" title={w.session ? `会话《${w.session}》` : '呼号未登记会话'}>
                      {w.executor}
                    </Chip>
                  )}
                </div>
                <div className="subtle mt-0.5 text-[11px] leading-relaxed">{w.purpose}</div>
                <div className="subtle mt-1 text-[11px]">
                  执行：{w.executor || '—'}{w.session ? ` · 会话《${w.session}》` : ''} · 状态：{w.status || '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 泳道 3：等您拍板 */}
        <Card className="card flex min-h-0 flex-col p-4">
          <h2 className="section-title mb-3 shrink-0">等您拍板（{openDr.length}）</h2>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {openDr.length === 0 && <p className="subtle text-sm">没有等您的事。该忙忙。</p>}
            {openDr.map((d) => (
              <div
                key={d.id}
                className="ledger-item cursor-pointer rounded-lg p-2.5 text-xs"
                style={{ background: 'var(--surface-2)', borderLeft: d.blocking ? '3px solid var(--danger)' : '3px solid var(--border)' }}
                onClick={() => setDrawer({ kind: 'dr', id: d.id })}
                title="点击查看决定文档原文"
              >
                <div className="font-medium">{d.oneLine}</div>
                <div className="subtle mt-0.5 text-[11px]">编号 {d.id}{d.blocking ? <> · <Icon name="pause" size={12} className="ic-inline" /> 不拍板就停着</> : ''}{d.due ? ` · 期限 ${d.due}` : ''}</div>
              </div>
            ))}
            {data.decisions.closedRecent.length > 0 && (
              <>
                <h3 className="subtle mb-1.5 mt-3 text-[11px] font-medium">最近已拍板</h3>
                <div className="flex flex-col gap-1 text-[11px]">
                  {data.decisions.closedRecent.map((d) => (
                    <button key={d.id} className="ledger-item subtle cursor-pointer rounded-lg px-2 py-1.5 text-left" onClick={() => setDrawer({ kind: 'dr', id: d.id })} title="点击查看决定文档原文">
                      <Icon name="check" size={14} className="ic-ok ic-inline" /> {d.oneLine}（{d.id}）
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* 泳道 4：办结工单（带删除，防台账文件累积） */}
        <Card className="card flex min-h-0 flex-col p-4">
          <h2 className="section-title mb-3 shrink-0">办结的{data.terms.wo}（{data.closedWorkorders.length}）</h2>
          {data.closedWorkorders.length === 0 && <p className="subtle shrink-0 text-sm">还没有办结单。</p>}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {data.closedWorkorders.map((w) => (
              <div
                key={w.id}
                className="ledger-item group flex cursor-pointer items-start gap-2 rounded-lg p-2.5"
                style={{ background: 'var(--surface-2)', ...laneStyle(w.executor) }}
                onClick={() => setDrawer({ kind: 'wo', id: w.id })}
                title="点击查看工单原文"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{w.id}</div>
                  <div className="subtle mt-0.5 line-clamp-2 text-[11px] leading-relaxed">{w.purpose}</div>
                </div>
                <button
                  className="del-btn shrink-0"
                  title="删除该归档单（可从 git 历史找回）"
                  onClick={(e) => { e.stopPropagation(); setConfirm(w.id); }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 台账原文抽屉：从右往左滑出（面板壳保留自绘——左贴侧栏+遮罩是定制品；
          内部按钮/徽章已 HeroUI v3 化） */}
      {drawer && (
        <>
          <div className="drawer-mask" onClick={() => setDrawer(null)} />
          <aside className="drawer" role="dialog" aria-label={`${drawer.id} 原文`}>
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-sm font-bold">{drawer.id}</h3>
                <Chip size="sm" variant="tertiary" className="shrink-0">{drawer.kind === 'wo' ? data.terms.wo : data.terms.dr}</Chip>
                <Button variant="ghost" size="sm" className="shrink-0 !min-w-0 !px-2 !text-[11px]" onPress={copyId} aria-label="复制单据 ID">
                  <Icon name={copied ? 'check' : 'copy'} size={13} className="ic-inline" />
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 !min-w-0 !px-2" onPress={() => setDrawer(null)} aria-label="关闭">
                <Icon name="close" size={16} />
              </Button>
            </header>
            <div className="drawer-body">
              {docErr && <p className="text-sm" style={{ color: 'var(--danger)' }}>加载失败：{docErr}</p>}
              {!docErr && !doc && <p className="subtle text-sm">加载中…</p>}
              {doc && <Markdown text={doc.content_md} />}
              {drawer.kind === 'dr' && doc && (
                <div className="verdict-form">
                  <h4 className="verdict-title">拍板答复 · 批复回填</h4>
                  <p className="subtle mt-0.5 text-[11px]">勾选结论（可多选），补充说明选填；提交后回填单据「答复」字段。</p>
                  <div className="verdict-options mt-2.5">
                    {VERDICT_OPTIONS.map((opt) => {
                      const on = verdict.choices.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          className="verdict-opt"
                          data-on={on ? 'true' : 'false'}
                          onClick={() =>
                            setVerdict((v) => ({
                              ...v,
                              choices: on ? v.choices.filter((c) => c !== opt) : [...v.choices, opt],
                            }))
                          }
                        >
                          <Icon name="check" size={12} className="ic-inline" />
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    className="verdict-note mt-2.5"
                    rows={3}
                    placeholder="补充说明（选填）：口径、条件、期限等…"
                    value={verdict.note}
                    onChange={(e) => setVerdict((v) => ({ ...v, note: e.target.value }))}
                  />
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span
                      className="min-w-0 flex-1 truncate text-xs"
                      style={{ color: vMsg && vMsg.startsWith('提交失败') ? 'var(--danger)' : 'var(--ok)' }}
                    >
                      {vMsg}
                    </span>
                    <Button variant="primary" size="sm" className="shrink-0" onPress={submitVerdict} isDisabled={vBusy}>
                      {vBusy ? '提交中…' : '提交批复'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* 删除确认弹层（HeroUI v3 Modal 复合件） */}
      <Modal state={confirmState}>
        <Modal.Backdrop isDismissable={!deleting} />
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Body className="gap-2">
              <h3 className="text-base font-bold">删除归档单</h3>
              <p className="subtle text-sm leading-relaxed">
                确定删除 <span className="font-semibold" style={{ color: 'var(--accent-deep)' }}>{confirm}</span> 吗？
                该归档单文件及其台账行会被移除（git 历史里仍可找回）。
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setConfirm(null)} isDisabled={deleting}>取消</Button>
              <Button variant="danger" onPress={doDelete} isDisabled={deleting}>
                {deleting ? '删除中…' : '删除'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </div>
  );
}
