import type { Pipeline, ReportDetail, ReportListItem, TeamInfo, Member, LedgerDoc, ArtifactsPayload, TokensPayload, EnvInfo, ArtifactDoc } from './types';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  team: () => get<{ team: TeamInfo; members: Member[] }>('/api/profile'),
  env: () => get<EnvInfo>('/api/env'),
  artifact: (path: string) => get<ArtifactDoc>(`/api/artifact?path=${encodeURIComponent(path)}`),
  pipeline: () => get<Pipeline>('/api/pipeline'),
  artifacts: () => get<ArtifactsPayload>('/api/artifacts'),
  reports: () => get<ReportListItem[]>('/api/reports'),
  report: (id: number) => get<ReportDetail>(`/api/reports/${id}`),
  deleteClosedWorkorder: (id: string) => del<{ ok: boolean; deleted: string }>(`/api/workorders/${id}`),
  workorderDoc: (id: string) => get<LedgerDoc>(`/api/workorders/${id}`),
  decisionDoc: (id: string) => get<LedgerDoc>(`/api/decisions/${id}`),
  tokens: () => get<TokensPayload>('/api/tokens'),
  decisionVerdict: (id: string, choices: string[], note: string) =>
    post<{ ok: boolean; content_md: string }>(`/api/decisions/${id}/verdict`, { choices, note }),
};
