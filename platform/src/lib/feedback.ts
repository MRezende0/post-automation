// feedback.ts: leitura e escrita de feedback e regras aprendidas (SPEC 003 R4/R5).
// Server-only (service role). A validação do que chega acontece antes, em learning.ts.

import type { TenantDb } from './tenant-db';
import type { Feedback, FeedbackInput, RuleInput, StyleRule } from './learning';

export async function saveFeedback(t: TenantDb, input: FeedbackInput): Promise<string> {
  const { data, error } = await t
    .insert('feedback', input)
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao gravar feedback: ${error.message}`);
  return data!.id as string;
}

export async function deleteFeedback(t: TenantDb, id: string): Promise<void> {
  const { error } = await t.delete('feedback').eq('id', id);
  if (error) throw new Error(`Falha ao apagar feedback: ${error.message}`);
}

export async function getRecentFeedback(t: TenantDb, limit = 30): Promise<Feedback[]> {
  const { data, error } = await t
    .select('feedback')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao ler feedback: ${error.message}`);
  return (data || []) as Feedback[];
}

export async function getRules(t: TenantDb): Promise<StyleRule[]> {
  const { data, error } = await t
    .select('style_rules', 'id,rule,aspect,channel,source,active,evidence,created_at')
    .order('active', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Falha ao ler regras: ${error.message}`);
  return (data || []) as StyleRule[];
}

export async function createRule(t: TenantDb, input: RuleInput): Promise<string> {
  const { data, error } = await t
    .insert('style_rules', { ...input, source: 'manual', active: true })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao criar regra: ${error.message}`);
  return data!.id as string;
}

// Reescrever uma regra a torna manual: a consolidação semanal não a desliga mais.
export async function updateRule(
  t: TenantDb,
  id: string,
  patch: { active?: boolean; input?: RuleInput },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.input) Object.assign(update, patch.input, { source: 'manual' });
  const { error } = await t.update('style_rules', update).eq('id', id);
  if (error) throw new Error(`Falha ao alterar regra: ${error.message}`);
}
