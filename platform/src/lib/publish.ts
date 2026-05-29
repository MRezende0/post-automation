// publish.ts — coração do scheduler. Publica os scheduled_posts vencidos e grava
// o post durável em `posts` (porta de queue.js:markPublishedToDb, preservando a
// mesma observabilidade que o backend Node gravava). Idempotente via lock de
// status (scheduled → publishing) com update condicional anti-corrida.

import { db } from './supabase';
import { notify, escapeHtml } from './telegram';
import * as instagram from './channels/instagram';
import * as linkedin from './channels/linkedin';
import type { ScheduledPost, Generation, Variation } from './types';

const MAX_ATTEMPTS = 3;

// Insere o post durável + todas as variações + eventos. Espelha o backend pra
// que bandit/métricas/calibração continuem funcionando igual.
async function persistPublishedPost(s: ScheduledPost, result: Record<string, unknown>): Promise<string> {
  const gen: Generation = (s.generation || { variations: [] }) as Generation;
  const chosenId = s.chosen_variation_id ?? null;
  const v = s.variation || ({} as Variation);

  const { data: post, error } = await db()
    .from('posts')
    .insert({
      pillar: s.pillar,
      angle: s.angle ?? null,
      channel: s.channel,
      context: (s.seed?.context as string) ?? null,
      hook: v.hook ?? null,
      body: v.body ?? null,
      format: v.format ?? 'single',
      chosen_variation: chosenId,
      channels: { [s.channel]: result },
      is_dry_run: false,
      prompt_hash: gen.prompt_hash ?? null,
      model: gen.model ?? null,
      judge_reason: gen.judge_reason ?? null,
      guardrail_flags: gen.guardrail_flags ?? null,
      generated_at: null,
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao gravar post: ${error.message}`);
  const postId = post!.id as string;

  const variations = gen.variations || [];
  if (variations.length) {
    const rows = variations.map((vv) => ({
      post_id: postId,
      variation_id: vv.id,
      hook: vv.hook ?? null,
      body: vv.body ?? null,
      format: vv.format ?? null,
      slides: vv.slides ?? null,
      heuristic_score: gen.heuristic_scores?.[String(vv.id)] ?? null,
      was_chosen: vv.id === chosenId,
    }));
    const { error: ve } = await db().from('post_variants').insert(rows);
    if (ve) console.error(`[publish] falha ao gravar variações: ${ve.message}`);
  }

  await db().from('post_events').insert({
    post_id: postId,
    type: 'published',
    payload: {
      channel: s.channel,
      chosen_variation: chosenId,
      chosen_art: s.chosen_art_id ?? null,
      channels: { [s.channel]: result },
      image_url: s.image_url ?? null,
      via: 'platform',
    },
  });

  if ((gen as any).judge_scores || gen.critic) {
    const chosenScore = (gen as any).judge_scores?.find?.((x: any) => x.id === chosenId);
    await db().from('post_events').insert({
      post_id: postId,
      type: 'judge_decision',
      payload: {
        scores: (gen as any).judge_scores ?? null,
        critic: gen.critic ?? null,
        expected_engagement: chosenScore?.expected_engagement ?? null,
      },
    });
  }

  return postId;
}

async function publishToChannel(s: ScheduledPost): Promise<Record<string, unknown>> {
  const caption = s.caption_final || '';
  if (s.channel === 'instagram') {
    if (s.variation?.format === 'carousel' && Array.isArray(s.slide_urls) && s.slide_urls.length >= 2) {
      return instagram.publishCarousel(s.slide_urls, caption);
    }
    if (!s.image_url) throw new Error('Instagram exige image_url');
    return instagram.publishSingle(s.image_url, caption);
  }
  if (s.channel === 'linkedin') {
    return linkedin.publishText(caption, s.image_url);
  }
  throw new Error(`Canal desconhecido: ${s.channel}`);
}

// Tenta publicar UM scheduled_post já travado em 'publishing'. Em sucesso grava
// posts + marca published; em falha incrementa attempts e volta pra scheduled
// (ou marca failed ao esgotar as tentativas).
async function processOne(s: ScheduledPost): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await publishToChannel(s);
    const postId = await persistPublishedPost(s, result);
    await db()
      .from('scheduled_posts')
      .update({ status: 'published', published_at: new Date().toISOString(), post_id: postId, last_error: null })
      .eq('id', s.id);
    await notify(`✅ Publicado em <b>${s.channel}</b> — ${escapeHtml((s.variation?.hook || '').slice(0, 80))}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const attempts = (s.attempts ?? 0) + 1;
    const failed = attempts >= MAX_ATTEMPTS;
    await db()
      .from('scheduled_posts')
      .update({ status: failed ? 'failed' : 'scheduled', attempts, last_error: msg })
      .eq('id', s.id);
    await notify(
      failed
        ? `🚨 Falha definitiva ao publicar em <b>${s.channel}</b> (${attempts} tentativas): ${escapeHtml(msg)}`
        : `⚠️ Falha ao publicar em <b>${s.channel}</b> (tentativa ${attempts}/${MAX_ATTEMPTS}), vou tentar de novo: ${escapeHtml(msg)}`,
    );
    return { ok: false, error: msg };
  }
}

// Varre os vencidos, trava cada um (anti-corrida) e publica. Retorna o resumo.
export async function runPublishDue(nowIso = new Date().toISOString()): Promise<{
  picked: number;
  published: number;
  failed: number;
}> {
  const { data, error } = await db()
    .from('scheduled_posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(20);
  if (error) throw new Error(`Falha ao buscar vencidos: ${error.message}`);

  let published = 0;
  let failed = 0;
  const ids = (data || []).map((r) => r.id as string);

  for (const id of ids) {
    // lock: só pega se ainda está 'scheduled' (outro cron não levou)
    const { data: locked, error: le } = await db()
      .from('scheduled_posts')
      .update({ status: 'publishing' })
      .eq('id', id)
      .eq('status', 'scheduled')
      .select('*')
      .single();
    if (le || !locked) continue; // outro processo levou ou sumiu
    const res = await processOne(locked as ScheduledPost);
    if (res.ok) published += 1;
    else failed += 1;
  }

  return { picked: ids.length, published, failed };
}
