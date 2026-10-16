// pause.ts: pausa global de publicação (migration 0008). Pausado, o scheduler não chama
// nenhuma rede; os agendados continuam na fila e saem no primeiro ciclo depois de retomar.

import type { TenantDb } from './tenant-db';

export type PauseState = { paused: boolean; reason: string | null; pausedAt: string | null };

const NOT_PAUSED: PauseState = { paused: false, reason: null, pausedAt: null };

// Sem a migration aplicada, segue publicando: travar tudo por falta de tabela seria pior.
export async function getPauseState(t: TenantDb): Promise<PauseState> {
  const { data, error } = await t.select('publishing_controls', 'paused,reason,paused_at').limit(1);
  if (error) {
    console.error(`[pause] falha ao ler pausa, seguindo sem pausa: ${error.message}`);
    return NOT_PAUSED;
  }
  const row = data?.[0];
  if (!row) return NOT_PAUSED;
  return { paused: !!row.paused, reason: row.reason ?? null, pausedAt: row.paused_at ?? null };
}

export async function setPause(t: TenantDb, paused: boolean, reason?: string | null): Promise<PauseState> {
  const now = new Date().toISOString();
  const row = {
    paused,
    reason: paused ? (reason?.trim() || null) : null,
    paused_at: paused ? now : null,
    updated_at: now,
  };
  const { error } = await t.upsert('publishing_controls', row, { onConflict: 'tenant_id' });
  if (error) throw new Error(`Falha ao gravar a pausa: ${error.message}`);
  return { paused: row.paused, reason: row.reason, pausedAt: row.paused_at };
}

// Agendados que já passaram do horário: saem juntos no primeiro ciclo depois de retomar.
export async function countOverdue(t: TenantDb, nowIso = new Date().toISOString()): Promise<number> {
  const { count, error } = await t
    .select('scheduled_posts', 'id', { count: 'exact', head: true })
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso);
  if (error) return 0;
  return count ?? 0;
}
