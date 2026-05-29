// scheduling.ts — ações de aprovação/agendamento (lado escrita). Substitui o que
// o resolve.js fazia a partir dos cliques do Telegram: aprovar uma pendência vira
// um scheduled_post (não publica na hora); cancelar/reagendar mexem na fila.

import { db } from './supabase';
import { notify, escapeHtml } from './telegram';
import { composeCaption } from './caption';
import { nextFreeSlot } from './slots';
import type { PendingApproval, Variation, ImageRef } from './types';

function fmtLocal(iso: string): string {
  const offset = Number(process.env.PUBLISH_TZ_OFFSET ?? -3);
  const d = new Date(new Date(iso).getTime() + offset * 3600 * 1000);
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dias[d.getUTCDay()]} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

async function loadPending(pendingId: string): Promise<PendingApproval | null> {
  const { data, error } = await db().from('pending_approvals').select('*').eq('pending_id', pendingId).limit(1);
  if (error) throw new Error(`Falha ao ler pending: ${error.message}`);
  return (data?.[0] as PendingApproval) ?? null;
}

export type ApproveInput = {
  pendingId: string;
  captionId: number; // variação escolhida pra legenda
  artId: number; // arte escolhida
  captionText?: string; // legenda editada (sobrescreve a sugerida)
  scheduledFor?: string; // ISO; se ausente cai no próximo slot livre
};

export async function approvePending(input: ApproveInput): Promise<{ scheduledFor: string; id: string }> {
  const p = await loadPending(input.pendingId);
  if (!p) throw new Error('Pendência não encontrada (já resolvida?).');

  const variations: Variation[] = p.generation?.variations || [];
  const variation = variations.find((v) => v.id === input.captionId) || variations[0];
  if (!variation) throw new Error('Variação de legenda inválida.');

  const images: ImageRef[] = p.images || [];
  const art = images.find((i) => i.id === input.artId);
  const imageUrl = art?.url ?? images[0]?.url ?? null;

  const captionFinal = (input.captionText && input.captionText.trim()) || composeCaption(variation);

  const scheduledFor = input.scheduledFor || (await nextFreeSlot(p.channel));
  if (!scheduledFor) {
    throw new Error('Sem slot livre na grade. Defina um horário manual ou adicione slots.');
  }

  const { data, error } = await db()
    .from('scheduled_posts')
    .insert({
      channel: p.channel,
      pillar: p.generation?.pillar ?? null,
      angle: p.generation?.angle ?? null,
      variation,
      chosen_variation_id: variation.id,
      caption_final: captionFinal,
      image_url: imageUrl,
      chosen_art_id: input.artId,
      slide_urls: null,
      generation: p.generation,
      seed: p.seed ?? null,
      status: 'scheduled',
      scheduled_for: scheduledFor,
      source_pending_id: p.pending_id,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao agendar: ${error.message}`);

  // consome a pendência (espelha clearPending por canal)
  await db().from('pending_approvals').delete().eq('channel', p.channel);

  await notify(`🗓️ Agendado em <b>${p.channel}</b> pra <b>${fmtLocal(scheduledFor)}</b> — ${escapeHtml((variation.hook || '').slice(0, 80))}`);
  return { scheduledFor, id: data!.id as string };
}

export async function rejectPending(pendingId: string, reason?: string): Promise<void> {
  const p = await loadPending(pendingId);
  if (!p) return;
  const top = (p.generation?.variations || []).find((v) => v.id === p.top_id) || p.generation?.variations?.[0];
  await db().from('rejected_posts').insert({
    pillar: p.generation?.pillar ?? null,
    angle: p.generation?.angle ?? null,
    channel: p.channel,
    hook: top?.hook ?? null,
    body: top?.body ?? null,
    format: top?.format ?? null,
    reason: reason || 'rejeitado via plataforma',
  });
  await db().from('pending_approvals').delete().eq('channel', p.channel);
  await notify(`❌ Pendência ${p.channel} rejeitada${reason ? `: ${escapeHtml(reason)}` : ''}`);
}

export async function reschedulePost(id: string, scheduledFor: string): Promise<void> {
  const { error } = await db()
    .from('scheduled_posts')
    .update({ scheduled_for: scheduledFor, status: 'scheduled', last_error: null })
    .eq('id', id)
    .in('status', ['scheduled', 'failed']);
  if (error) throw new Error(`Falha ao reagendar: ${error.message}`);
}

export async function cancelScheduled(id: string): Promise<void> {
  const { error } = await db().from('scheduled_posts').delete().eq('id', id).in('status', ['scheduled', 'failed']);
  if (error) throw new Error(`Falha ao cancelar: ${error.message}`);
}

export async function retryScheduled(id: string): Promise<void> {
  const { error } = await db()
    .from('scheduled_posts')
    .update({ status: 'scheduled', last_error: null })
    .eq('id', id)
    .eq('status', 'failed');
  if (error) throw new Error(`Falha ao re-tentar: ${error.message}`);
}

export { fmtLocal };
