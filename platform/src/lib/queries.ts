// queries.ts — leituras (lado read) usadas pelos Server Components.

import { db } from './supabase';
import type { PendingApproval, ScheduledPost, PublishedPost, PublishSlot } from './types';

export async function getPendings(): Promise<PendingApproval[]> {
  const { data, error } = await db()
    .from('pending_approvals')
    .select('*')
    .order('saved_at', { ascending: false });
  if (error) throw new Error(`Falha ao ler pendências: ${error.message}`);
  return (data || []) as PendingApproval[];
}

export async function getPending(pendingId: string): Promise<PendingApproval | null> {
  const { data, error } = await db().from('pending_approvals').select('*').eq('pending_id', pendingId).limit(1);
  if (error) throw new Error(`Falha ao ler pendência: ${error.message}`);
  return (data?.[0] as PendingApproval) ?? null;
}

export async function getScheduled(statuses: string[] = ['scheduled', 'publishing', 'failed']): Promise<ScheduledPost[]> {
  const { data, error } = await db()
    .from('scheduled_posts')
    .select('*')
    .in('status', statuses)
    .order('scheduled_for', { ascending: true });
  if (error) throw new Error(`Falha ao ler agendados: ${error.message}`);
  return (data || []) as ScheduledPost[];
}

export async function getPublishedHistory(limit = 50): Promise<PublishedPost[]> {
  const { data, error } = await db()
    .from('posts')
    .select('id,pillar,angle,channel,hook,body,format,channels,engagement_score,published_at')
    .eq('is_dry_run', false)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao ler histórico: ${error.message}`);
  return (data || []) as PublishedPost[];
}

export async function getRecentlyPublishedScheduled(limit = 30): Promise<ScheduledPost[]> {
  const { data, error } = await db()
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao ler publicados: ${error.message}`);
  return (data || []) as ScheduledPost[];
}

export async function getSlots(): Promise<PublishSlot[]> {
  const { data, error } = await db().from('publish_slots').select('*').order('channel').order('weekday').order('hour');
  if (error) throw new Error(`Falha ao ler slots: ${error.message}`);
  return (data || []) as PublishSlot[];
}

export async function countByStatus(): Promise<{ pendings: number; scheduled: number; failed: number }> {
  const [p, s, f] = await Promise.all([
    db().from('pending_approvals').select('id', { count: 'exact', head: true }),
    db().from('scheduled_posts').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    db().from('scheduled_posts').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);
  return { pendings: p.count ?? 0, scheduled: s.count ?? 0, failed: f.count ?? 0 };
}
