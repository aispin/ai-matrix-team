import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../icon';
import { Button, Card } from '@heroui/react';
import type { Member, TeamInfo } from '../types';

export default function About() {
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.team()
      .then((d) => { setTeam(d.team); setMembers(d.members ?? []); })
      .catch(() => setTeam(null));
  }, []);

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
          <h2 className="text-xl font-bold">{team?.name ?? 'AI Matrix Team'}</h2>
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
          {members.map((m) => (
            <Card key={m.id} className="card !p-4">
              <Card.Content className="flex flex-row items-start gap-3 !p-0">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
                  style={{ background: m.color, color: '#fff' }}
                  aria-hidden={!!m.avatar}
                >
                  {m.avatar
                    ? <img src={`/api/avatar/${m.avatar}`} alt={m.name} className="h-full w-full object-cover" />
                    : m.name.slice(0, 1)}
                </span>
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
