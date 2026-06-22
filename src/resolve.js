// resolve.js — FASE RESOLVER. Disparada por um cron curto (resolve.yml).
// Lê as decisões que chegaram no Telegram (cliques nos botões / motivo de
// rejeição) e age sobre cada pending: publica, regenera ou rejeita. Roda em
// segundos e encerra — nunca segura o runner esperando.

import 'dotenv/config';
import { getPending, savePending, clearPending, markPublished, markRejected } from './utils/queue.js';
import { prepareGeneration, publishToChannel } from './pipeline.js';
import { sendApprovalRequest, fetchDecisions, confirmDecisions, finalizeKeyboard, showArtSelection, notify, escapeHtml } from './telegram.js';
import { resolveTenant } from './tenant.js';

const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_REGEN = Number(process.env.MAX_REGEN || 3);
// Janela pra você mandar o motivo da rejeição antes de registrar sem motivo.
const REASON_WINDOW_MS = Number(process.env.REASON_WINDOW_MS || 6 * 60 * 60 * 1000);

function log(...args) {
  console.log('[resolve]', ...args);
}

function newPendingId(channel) {
  return `${channel}-${Date.now().toString(36)}`;
}

function publishedRecord(p, chosen) {
  return {
    ...p.seed,
    pillar: p.generation.pillar,
    angle: p.generation.angle,
    post: { hook: chosen.hook, body: chosen.body, format: chosen.format },
    generated_at: new Date().toISOString(),
  };
}

// Passo 1: legenda escolhida → guarda e mostra o teclado de arte.
async function handleCaption(p, captionId) {
  const cap = p.generation.variations.find(v => v.id === captionId);
  if (!cap) {
    log(`Pending ${p.pending_id}: legenda ${captionId} inexistente — ignorando`);
    return;
  }
  log(`Legenda #${captionId} escolhida (${p.channel}) — aguardando arte`);
  await savePending({ ...p, chosen_caption_id: captionId, status: 'awaiting_art' });
  await showArtSelection({
    messageId: p.keyboard_message_id,
    pendingId: p.pending_id,
    images: p.images || [],
    captionId,
    dryRun: DRY_RUN,
  });
}

// Passo 2: arte escolhida → publica legenda + arte. captionId vem do callback
// (g:pid:caption:art), não do estado persistido — robusto entre runs.
async function handleArt(p, captionId, artId) {
  const gen = p.generation;
  const capId = captionId ?? p.chosen_caption_id ?? p.top_id;
  const chosen = gen.variations.find(v => v.id === capId) || gen.variations[0];
  const imageUrl = p.images?.find(i => i.id === artId)?.url;
  if (!chosen) {
    log(`Pending ${p.pending_id}: legenda ${capId} inexistente — ignorando`);
    return;
  }
  log(`Publicando ${p.channel}: legenda #${capId} + arte #${artId} (pending ${p.pending_id})`);

  const result = await publishToChannel({ channel: p.channel, variation: chosen, imageUrl, pillar: gen.pillar });
  await markPublished(publishedRecord(p, chosen), {
    chosenVariationId: chosen.id,
    channels: { [p.channel]: result },
    generation: gen,
    images: p.images,
    chosenArtId: artId,
  });
  await clearPending(p.channel);
  await finalizeKeyboard({
    messageId: p.keyboard_message_id,
    text: `✅ <b>Publicado em ${p.channel}</b> — legenda #${capId} + arte #${artId}.`,
    dryRun: DRY_RUN,
  });
  await notify(`✅ Publicado em ${p.channel} — legenda #${capId} + arte #${artId}`, { dryRun: DRY_RUN });
}

// Compat (1 clique): legenda e arte da MESMA variação.
async function handleApprove(p, chosenId) {
  const gen = p.generation;
  const chosen = gen.variations.find(v => v.id === chosenId) || gen.variations.find(v => v.id === p.top_id);
  if (!chosen) {
    log(`Pending ${p.pending_id}: variação ${chosenId} inexistente — ignorando`);
    return;
  }
  const imageUrl = p.images?.find(i => i.id === chosen.id)?.url;
  log(`Aprovado ${p.channel} #${chosen.id} (pending ${p.pending_id}) — publicando`);

  const result = await publishToChannel({ channel: p.channel, variation: chosen, imageUrl, pillar: gen.pillar });
  await markPublished(publishedRecord(p, chosen), { chosenVariationId: chosen.id, channels: { [p.channel]: result }, generation: gen, images: p.images, chosenArtId: chosen.id });
  await clearPending(p.channel);
  await finalizeKeyboard({
    messageId: p.keyboard_message_id,
    text: `✅ <b>Variação #${chosen.id} publicada</b> em ${p.channel}.`,
    dryRun: DRY_RUN,
  });
  await notify(`✅ Publicado em ${p.channel} — variação #${chosen.id}`, { dryRun: DRY_RUN });
}

async function handleRegen(p, tenant) {
  if (p.regen_count >= MAX_REGEN) {
    log(`Pending ${p.pending_id}: limite de ${MAX_REGEN} regen atingido`);
    await notify(`🔄 Limite de ${MAX_REGEN} regenerações em ${p.channel}. Aprove ou rejeite o preview atual.`, { dryRun: DRY_RUN });
    return;
  }
  const attempt = p.regen_count + 1;
  log(`Regenerando ${p.channel} (tentativa ${attempt}/${MAX_REGEN}) — pending ${p.pending_id}`);
  await finalizeKeyboard({
    messageId: p.keyboard_message_id,
    text: `🔄 Regenerado (tentativa ${attempt}). Veja a nova versão abaixo 👇`,
    dryRun: DRY_RUN,
  });
  await notify(`🔄 Regenerando ${p.channel} (tentativa ${attempt}/${MAX_REGEN})...`, { dryRun: DRY_RUN });

  const regenNote = `Tentativa ${attempt + 1}: as variações anteriores foram recusadas. Mude o ÂNGULO e a ABERTURA — não repita o mesmo gancho.`;
  const prepared = await prepareGeneration({ channel: p.channel, seed: p.seed, regenNote, tenant });
  const pendingId = newPendingId(p.channel);
  const { keyboardMessageId, messageIds } = await sendApprovalRequest({
    channel: p.channel,
    pillar: prepared.generation.pillar,
    angle: prepared.generation.angle,
    variations: prepared.generation.variations,
    pendingId,
    images: prepared.images,
    dryRun: DRY_RUN,
  });
  await savePending({
    channel: p.channel,
    pending_id: pendingId,
    generation: prepared.generation,
    top_id: prepared.topId,
    images: prepared.images,
    seed: p.seed,
    message_ids: messageIds,
    keyboard_message_id: keyboardMessageId,
    regen_count: attempt,
    status: 'awaiting_decision',
  });
}

async function handleReject(p) {
  log(`Rejeitado ${p.channel} (pending ${p.pending_id}) — aguardando motivo`);
  await savePending({ ...p, status: 'awaiting_reason', reason_requested_at: new Date().toISOString() });
  await finalizeKeyboard({
    messageId: p.keyboard_message_id,
    text: '❌ Rejeitado. Se quiser, mande o motivo numa mensagem que eu registro como anti-exemplo.',
    dryRun: DRY_RUN,
  });
  await notify(`❌ Post ${p.channel} rejeitado. Mande o motivo (opcional) nos próximos minutos.`, { dryRun: DRY_RUN });
}

// Pendings que esperam o motivo da rejeição: consomem o primeiro texto enviado
// após o pedido, ou são finalizados sem motivo passada a janela.
async function resolveReasons(pendings, texts) {
  for (const p of pendings.filter(x => x.status === 'awaiting_reason')) {
    const since = new Date(p.reason_requested_at || p.saved_at).getTime();
    const reason = texts.filter(t => t.date * 1000 > since).map(t => t.text)[0];
    const top = p.generation.variations.find(v => v.id === p.top_id) || p.generation.variations[0];

    if (reason) {
      await markRejected({ ...p.seed, channel: p.channel, pillar: p.generation.pillar, angle: p.generation.angle, post: { hook: top.hook, body: top.body, format: top.format } }, reason);
      await clearPending(p.channel);
      await notify(`📝 Motivo registrado pra ${p.channel}: ${escapeHtml(reason)}`, { dryRun: DRY_RUN });
      log(`Motivo de rejeição registrado (${p.channel}): ${reason}`);
    } else if (Date.now() - since > REASON_WINDOW_MS) {
      await markRejected({ ...p.seed, channel: p.channel, pillar: p.generation.pillar, angle: p.generation.angle, post: { hook: top.hook, body: top.body, format: top.format } }, 'rejeitado via Telegram (sem motivo)');
      await clearPending(p.channel);
      log(`Rejeição finalizada sem motivo (janela expirada) — ${p.channel}`);
    }
  }
}

async function main() {
  const tenant = resolveTenant();
  log(`Iniciando RESOLVE | tenant=${tenant.id} | DRY_RUN=${DRY_RUN}`);
  const pendings = await getPending();
  const { decisions, texts, maxUpdateId, callbackAcks } = await fetchDecisions({ dryRun: DRY_RUN });
  log(`${pendings.length} pending(s) | ${decisions.length} clique(s) | ${texts.length} texto(s)`);

  // Motivos de rejeição primeiro (consome textos de runs anteriores).
  await resolveReasons(pendings, texts);

  // Processa em ORDEM cronológica com estado em memória — o fluxo de 2 cliques
  // (legenda → arte) exige que a legenda seja aplicada antes da arte no mesmo run.
  // _done trava ações terminais (publicou/rejeitou/regenerou) contra clique duplo.
  const byId = new Map(pendings.map(p => [p.pending_id, { ...p }]));
  for (const d of decisions) {
    const p = byId.get(d.pendingId);
    if (!p) {
      log(`Decisão pra pending desconhecido/resolvido (${d.pendingId}) — ignorando`);
      continue;
    }
    if (p.status === 'awaiting_reason' || p._done) continue;
    if (d.action === 'caption') {
      await handleCaption(p, d.chosenCaptionId);
      p.chosen_caption_id = d.chosenCaptionId;
      p.status = 'awaiting_art';
    } else if (d.action === 'art') {
      await handleArt(p, d.chosenCaptionId, d.chosenArtId);
      p._done = true;
    } else if (d.action === 'approve') {
      await handleApprove(p, d.chosenId);
      p._done = true;
    } else if (d.action === 'regen') {
      await handleRegen(p, tenant);
      p._done = true;
    } else if (d.action === 'reject') {
      await handleReject(p);
      p._done = true;
    }
  }

  // Ack no servidor do Telegram só depois de processar tudo com sucesso.
  await confirmDecisions({ maxUpdateId, callbackAcks, dryRun: DRY_RUN });
  log('Fim do resolve.');
}

main().catch(async (err) => {
  console.error('[resolve] ERRO:', err);
  try {
    await notify(`🚨 Resolve falhou: ${err.message}`, { dryRun: DRY_RUN });
  } catch (_) {}
  process.exit(1);
});
