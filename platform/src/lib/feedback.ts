// feedback.ts: leitura e escrita de feedback e regras aprendidas (SPEC 003 R4/R5).
// Server-only (service role). A validação do que chega acontece antes, em learning.ts.

import { db } from './supabase';
import { TENANT_ID } from './tenant';
import type { Feedback, FeedbackInput, RuleInput, StyleRule } from './learning';

export async function saveFeedback(input: FeedbackInput): Promise<string> {
  const { data, error } = await db()
    .from('feedback')
    .insert({ ...input, tenant_id: TENANT_ID })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao gravar feedback: ${error.message}`);
  return data!.id as string;
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await db().from('feedback').delete().eq('id', id).eq('tenant_id', TENANT_ID);
  if (error) throw new Error(`Falha ao apagar feedback: ${error.message}`);
}

export async function getRecentFeedback(limit = 30): Promise<Feedback[]> {
  const { data, error } = await db()
    .from('feedback')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao ler feedback: ${error.message}`);
  return (data || []) as Feedback[];
}

export async function getRules(): Promise<StyleRule[]> {
  const { data, error } = await db()
    .from('style_rules')
    .select('id,rule,aspect,channel,source,active,evidence,created_at')
    .eq('tenant_id', TENANT_ID)
    .order('active', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Falha ao ler regras: ${error.message}`);
  return (data || []) as StyleRule[];
}

export async function createRule(input: RuleInput): Promise<string> {
  const { data, error } = await db()
    .from('style_rules')
    .insert({ ...input, tenant_id: TENANT_ID, source: 'manual', active: true })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao criar regra: ${error.message}`);
  return data!.id as string;
}

// Reescrever uma regra a torna manual: a consolidação semanal não a desliga mais.
export async function updateRule(id: string, patch: { active?: boolean; input?: RuleInput }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.input) Object.assign(update, patch.input, { source: 'manual' });
  const { error } = await db().from('style_rules').update(update).eq('id', id).eq('tenant_id', TENANT_ID);
  if (error) throw new Error(`Falha ao alterar regra: ${error.message}`);
}
