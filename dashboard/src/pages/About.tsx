import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../icon';
import { Avatar, Button, Card } from '@heroui/react';
import type { TeamInfo } from '../types';

export default function About() {
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { api.team().then((d) => setTeam(d.team)).catch(() => setTeam(null)); }, []);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="card !p-6">
        <Card.Content className="!p-0">
          <h2 className="text-xl font-bold">{team?.name ?? 'AI-Matrix 专家团'}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--accent)' }}>{team?.tagline}</p>
          <p className="mt-3 text-sm leading-relaxed">{team?.about}</p>
        </Card.Content>
      </Card>

      {team?.dedication && (
        <Card className="card !p-6">
          <Card.Content className="!p-0">
            <h2 className="section-title mb-3">{team.dedication.title}</h2>
            <p className="text-sm leading-relaxed">{team.dedication.text}</p>
            <div className="mt-4 rounded-xl px-5 py-4" style={{ background: 'var(--surface-2)', borderLeft: '3px solid var(--accent)' }}>
              {team.dedication.poem.map((line, i) => (
                <p key={i} className="text-sm leading-7" style={{ color: 'var(--text-2)' }}>{line}</p>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      <section>
        <h2 className="section-title mb-3">我们擅长什么</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team?.capabilities.map((c) => (
            <Card key={c.title} className="card !p-4">
              <Card.Content className="!p-0">
                <div className="font-semibold">{c.title}</div>
                <p className="subtle mt-1.5 text-xs leading-relaxed">{c.desc}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title mb-3">团队成员</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: 'PC', role: '产研高级总监 · 团长', color: 'var(--id-1)', desc: '接您的每一句话，开单派活、把关卡、核准公共区写入（风控并入），汇总交付。全队的入口。' },
            { name: '毛毛', role: '资深产品设计师', color: 'var(--id-2)', desc: '一条链三件事：BRD 立项论证 → PRD 验收标准 → 可交互设计稿（双主题可点击）。' },
            { name: 'Bruce', role: '资深开发工程师', color: 'var(--id-6)', desc: '动码前 15 分钟架构速断（TDD 增量 / ADR / 破坏性自查），按单施工，只在批准范围内动手。' },
            { name: '石头', role: '资深质检工程师', color: 'var(--id-7)', desc: '独立验货：逐条核对验收标准，一票打回；破坏性影响面只核对不裁量；月度合规体检。' },
            { name: '陈波', role: '资深运维工程师', color: 'var(--id-8)', desc: '部署、迁移、回滚，上线的事他兜底。' },
          ].map((m) => (
            <Card key={m.name} className="card !p-4">
              <Card.Content className="flex flex-row items-start gap-3 !p-0">
                <Avatar
                  className="h-10 w-10 shrink-0 text-lg font-bold"
                  style={{ background: m.color, color: '#fff' }}
                />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{m.name}</span>
                    <span className="subtle text-xs">{m.role}</span>
                  </div>
                  <p className="subtle mt-1 text-xs leading-relaxed">{m.desc}</p>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>

      <Card className="card !p-5">
        <Card.Content className="!p-0">
          <h2 className="section-title mb-1">试试这样问我</h2>
          <p className="subtle mt-1 text-xs">在专家团对话里直接说下面任意一句：</p>
          <ul className="mt-3 flex flex-col gap-2">
            {team?.tryAsk.map((q) => (
              <li key={q}>
                <Button
                  fullWidth
                  variant="outline"
                  className="!justify-start !border-dashed !px-3 !py-2 text-left !text-sm !font-normal"
                  style={{ background: 'var(--surface-2)' }}
                  onPress={() => copy(q)}
                >
                  <span className="min-w-0 flex-1 truncate text-left">「{q}」</span>
                  {copied === q && (
                    <span className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs" style={{ color: 'var(--ok)' }}>
                      已复制 <Icon name="check" size={12} />
                    </span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>
    </div>
  );
}
