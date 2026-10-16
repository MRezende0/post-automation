// engage.ts: engajamento no LinkedIn (SPEC 005 R3), lado servidor. Rascunha 3 opções com a
// voz e as regras aprendidas, publica pela API só com clique e dentro dos limites, e registra
// tudo em `engagements`. Quando a API recusa, o rascunho fica pronto pra copiar e colar.

import { db } from './supabase';
import { TENANT_ID } from './tenant';
import { generateJson } from './gemini';
import * as linkedin from './channels/linkedin';
import {
  buildEngagePrompt,
  checkRateLimit,
  dayStartIso,
  normalizeOptions,
  shouldOfferCopy,
  weekStartIso,
  type DraftInput,
  type EngageKind,
} from './engage-model';

export type Engagement = {
  id: string;
  kind: EngageKind;
  target_url: string;
  target_author: string | null;
  target_text: string;
  options: string[] | null;
  comment_text: string | null;
  status: 'rascunho' | 'publicado' | 'copiado' | 'falhou';
  error: string | null;
  created_at: string;
  posted_at: string | null;
};

export type EngageTarget = { id: string; name: string; profile_url: string; note: string | null; active: boolean };

const TEXT_ASPECTS = ['texto', 'tom'];

// Regras de texto e tom + feedback negativo recente: o comentário fala com a mesma voz dos posts.
async function learnedVoice(): Promise<{ rules: string[]; avoid: string[] }> {
  const since = new Date(Date.now() - 14 * 86400 * 1000).toISOString();
  const [rules, feedback] = await Promise.all([
    db().from('style_rules').select('rule,aspect').eq('tenant_id', TENANT_ID).eq('active', true).limit(30),
    db()
      .from('feedback')
      .select('note,aspect')
      .eq('tenant_id', TENANT_ID)
      .eq('sentiment', 'negativo')
      .gte('created_at', since)
      .limit(20),
  ]);
  return {
    rules: (rules.data || []).filter((r) => !r.aspect || TEXT_ASPECTS.includes(r.aspect)).map((r) => r.rule).slice(0, 12),
    avoid: (feedback.data || []).filter((f) => TEXT_ASPECTS.includes(f.aspect)).map((f) => f.note).slice(0, 8),
  };
}

export async function draftEngagement(input: DraftInput): Promise<{ id: string; options: string[] }> {
  const voice = await learnedVoice().catch(() => ({ rules: [], avoid: [] }));
  const prompt = buildEngagePrompt({ kind: input.target.kind, targetText: input.targetText, author: input.author, ...voice });
  const options = normalizeOptions(await generateJson(prompt));
  if (!options.length) throw new Error('O modelo não devolveu sugestões. Tente gerar de novo.');

  const { data, error } = await db()
    .from('engagements')
    .insert({
      tenant_id: TENANT_ID,
      kind: input.target.kind,
      target_url: input.url,
      target_urn: input.target.object,
      parent_comment_urn: input.target.parentComment,
      target_author: input.author,
      target_text: input.targetText,
      options,
      status: 'rascunho',
    })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao salvar o rascunho: ${error.message}`);
  return { id: data!.id as string, options };
}

async function usage(): Promise<{ postedToday: number; postedThisWeek: number; lastPostedAt: string | null }> {
  const base = () => db().from('engagements').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID);
  const [today, week, last] = await Promise.all([
    base().eq('status', 'publicado').gte('posted_at', dayStartIso()),
    base().in('status', ['publicado', 'copiado']).gte('posted_at', weekStartIso()),
    db()
      .from('engagements')
      .select('posted_at')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'publicado')
      .order('posted_at', { ascending: false })
      .limit(1),
  ]);
  return {
    postedToday: today.count ?? 0,
    postedThisWeek: week.count ?? 0,
    lastPostedAt: (last.data?.[0]?.posted_at as string) ?? null,
  };
}

export async function getEngageSummary(): Promise<{ postedToday: number; postedThisWeek: number }> {
  const u = await usage();
  return { postedToday: u.postedToday, postedThisWeek: u.postedThisWeek };
}

async function loadDraft(id: string) {
  const { data, error } = await db().from('engagements').select('*').eq('id', id).eq('tenant_id', TENANT_ID).limit(1);
  if (error) throw new Error(`Falha ao ler o rascunho: ${error.message}`);
  const row = data?.[0];
  if (!row) throw new Error('Rascunho não encontrado. Gere as sugestões de novo.');
  if (row.status === 'publicado') throw new Error('Esse comentário já foi publicado.');
  return row;
}

// Publica pela API. Falha da API não lança: volta { ok: false, offerCopy } pra tela oferecer
// copiar e abrir o post, e o registro fica como `falhou` com o erro.
export async function publishEngagement(
  id: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string; offerCopy: boolean }> {
  const row = await loadDraft(id);
  const limit = checkRateLimit(await usage());
  if (!limit.ok) return { ok: false, error: limit.error, offerCopy: true };

  try {
    const r = await linkedin.commentOnPost(row.target_urn, text, { parentComment: row.parent_comment_urn });
    await db()
      .from('engagements')
      .update({ status: 'publicado', comment_text: text, comment_urn: r.id, error: null, posted_at: new Date().toISOString() })
      .eq('id', id);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db().from('engagements').update({ status: 'falhou', comment_text: text, error: msg }).eq('id', id);
    return { ok: false, error: msg, offerCopy: shouldOfferCopy(msg) };
  }
}

// "Copiar e abrir o post": conta pra meta da semana, não pro limite da API.
export async function markCopied(id: string, text: string): Promise<void> {
  await loadDraft(id);
  const { error } = await db()
    .from('engagements')
    .update({ status: 'copiado', comment_text: text, posted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`Falha ao registrar: ${error.message}`);
}

export async function listEngagements(limit = 30): Promise<Engagement[]> {
  const { data, error } = await db()
    .from('engagements')
    .select('id,kind,target_url,target_author,target_text,options,comment_text,status,error,created_at,posted_at')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao ler o engajamento: ${error.message}`);
  return (data || []) as Engagement[];
}

export async function listTargets(): Promise<EngageTarget[]> {
  const { data, error } = await db()
    .from('engage_targets')
    .select('id,name,profile_url,note,active')
    .eq('tenant_id', TENANT_ID)
    .eq('active', true)
    .order('name');
  if (error) throw new Error(`Falha ao ler as contas-alvo: ${error.message}`);
  return (data || []) as EngageTarget[];
}

export async function addTarget(input: { name: string; profile_url: string; note: string | null }): Promise<void> {
  const { error } = await db().from('engage_targets').insert({ ...input, tenant_id: TENANT_ID });
  if (error) throw new Error(`Falha ao salvar a conta: ${error.message}`);
}

export async function removeTarget(id: string): Promise<void> {
  const { error } = await db().from('engage_targets').update({ active: false }).eq('id', id).eq('tenant_id', TENANT_ID);
  if (error) throw new Error(`Falha ao remover a conta: ${error.message}`);
}
