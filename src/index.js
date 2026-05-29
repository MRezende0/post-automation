// index.js — FASE GERAR do workflow post.yml.
// Gera as variações, manda o preview de aprovação no Telegram, salva o pending
// e ENCERRA. A decisão (aprovar/regenerar/rejeitar) é processada depois pela
// FASE RESOLVER (src/resolve.js), disparada por um cron curto. Assim o runner
// nunca fica preso esperando o clique.
//
// Flags via env: DRY_RUN, PUBLISH_TEST, SKIP_APPROVAL.

import 'dotenv/config';
import { renderPreview, prepareGeneration, publishToChannel } from './pipeline.js';
import { popNext, markPublished, loadPending, savePending, expirePending } from './utils/queue.js';
import { uploadImage } from './utils/storage.js';
import * as instagram from './channels/instagram.js';
import * as linkedin from './channels/linkedin.js';
import { sendApprovalRequest, notify } from './telegram.js';
import { getUpcomingHoliday, holidayContext } from './utils/holidays.js';
import { getActiveCampaign, campaignContext } from './utils/calendar.js';

const DRY_RUN = process.env.DRY_RUN === 'true';
const PUBLISH_TEST = process.env.PUBLISH_TEST === 'true';
const SKIP_APPROVAL = process.env.SKIP_APPROVAL === 'true' || DRY_RUN;
const HOLIDAY_AWARE = process.env.HOLIDAY_AWARE !== 'false';
const HOLIDAY_WINDOW_DAYS = Number(process.env.HOLIDAY_WINDOW_DAYS || 7);
const CAMPAIGN_AWARE = process.env.CAMPAIGN_AWARE !== 'false';

const CHANNELS = (process.env.CHANNELS || 'instagram').split(',').map(s => s.trim());

function newPendingId(channel) {
  return `${channel}-${Date.now().toString(36)}`;
}

async function main() {
  log(`Iniciando GERAÇÃO | DRY_RUN=${DRY_RUN} | PUBLISH_TEST=${PUBLISH_TEST} | SKIP_APPROVAL=${SKIP_APPROVAL}`);

  if (PUBLISH_TEST) {
    return runPublishTest();
  }

  const expired = await expirePending();
  for (const e of expired) {
    log(`Pending expirado descartado: ${e.channel} (saved_at=${e.saved_at})`);
    await notify(`🗑️ Pending ${e.channel} expirou (>7d) e foi descartado`, { dryRun: DRY_RUN }).catch(() => {});
  }

  const queueItem = await popNext();
  const seed = queueItem || {};
  log(`Item da fila: ${queueItem ? JSON.stringify(queueItem) : 'vazio, gera automático'}`);

  // Prioridade no modo automático: campanha ativa > feriado próximo > rotação.
  let campaignActive = false;
  if (CAMPAIGN_AWARE && !seed.pillar) {
    const campaign = await getActiveCampaign(new Date());
    if (campaign) {
      campaignActive = true;
      if (campaign.pillar) seed.pillar = campaign.pillar;
      if (campaign.angle) seed.angle = campaign.angle;
      seed.context = [seed.context, campaignContext(campaign)].filter(Boolean).join('\n\n');
      log(`Campanha ativa → "${campaign.name}" (pilar=${campaign.pillar || 'rotação'}, ângulo=${campaign.angle || 'rotação'})`);
    }
  }

  // Sem campanha nem item forçado, um feriado próximo tem prioridade sobre a rotação.
  if (HOLIDAY_AWARE && !campaignActive && !seed.pillar) {
    const holiday = getUpcomingHoliday(new Date(), HOLIDAY_WINDOW_DAYS);
    if (holiday) {
      seed.pillar = holiday.pillar;
      seed.angle = holiday.angle;
      seed.context = [seed.context, holidayContext(holiday)].filter(Boolean).join('\n\n');
      log(`Feriado em ${holiday.daysUntil}d → post temático: ${holiday.name} (pilar=${holiday.pillar}, ângulo=${holiday.angle})`);
    }
  }

  for (const channel of CHANNELS) {
    log(`\n=== Canal: ${channel} ===`);

    // Já tem post aguardando decisão nesse canal? Não gera por cima — o resolve cuida.
    const pending = await loadPending(channel, { peek: true });
    if (pending && !SKIP_APPROVAL) {
      log(`Pending ativo em ${channel} (${pending.pending_id}) — pulando geração até resolver`);
      await notify(`⏳ Já há um post ${channel} aguardando sua decisão — resolva antes de gerar outro`, { dryRun: DRY_RUN }).catch(() => {});
      continue;
    }

    const prepared = await prepareGeneration({ channel, seed });
    const { generation, topId, images } = prepared;

    if (SKIP_APPROVAL) {
      await publishApproved({ channel, generation, chosenId: topId, images, seed });
      continue;
    }

    const pendingId = newPendingId(channel);
    const { keyboardMessageId, messageIds } = await sendApprovalRequest({
      channel,
      pillar: generation.pillar,
      angle: generation.angle,
      variations: generation.variations,
      pendingId,
      images,
    });
    log(`Preview enviado (pending ${pendingId}, ${messageIds.length} msgs)`);

    await savePending({
      channel,
      pending_id: pendingId,
      generation,
      top_id: topId,
      images,
      seed,
      message_ids: messageIds,
      keyboard_message_id: keyboardMessageId,
      regen_count: 0,
      status: 'awaiting_decision',
    });
  }

  log('\nFim da geração. Decisões serão processadas pelo resolve.');
}

// Caminho SKIP_APPROVAL/DRY_RUN: publica o top-1 sem passar pelo Telegram.
async function publishApproved({ channel, generation, chosenId, images, seed }) {
  const chosen = generation.variations.find(v => v.id === chosenId);
  const imageUrl = images.find(i => i.id === chosenId)?.url;
  const publishResult = await publishToChannel({ channel, variation: chosen, imageUrl, pillar: generation.pillar });
  log(`Publicou em ${channel}: ${JSON.stringify(publishResult)}`);

  // Dry-run não entra no histórico — poluiria aprendizado, métricas e anti-repetição.
  if (DRY_RUN) return;

  await markPublished(
    {
      ...seed,
      pillar: generation.pillar,
      angle: generation.angle,
      post: { hook: chosen.hook, body: chosen.body, format: chosen.format },
      generated_at: new Date().toISOString(),
    },
    { chosenVariationId: chosen.id, channels: { [channel]: publishResult }, generation, images },
  );
  await notify(`✅ Publicado em: ${channel} (variação #${chosen.id}, sem aprovação)`, { dryRun: DRY_RUN });
}

async function runPublishTest() {
  log('Modo PUBLISH_TEST: posta item hardcoded em sandbox');
  const variation = {
    id: 1,
    hook: '[TESTE] Post de validação do pipeline',
    body: '[TESTE] Esse é um post de teste pra validar credenciais e fluxo. Ignore.',
    format: 'single',
  };
  const imagePath = await renderPreview({ channel: 'instagram', pillar: 'dor', variation });
  const uploaded = await uploadImage(imagePath);
  log('Upload imagem:', uploaded.url);
  const ig = await instagram.publishSingle({ imageUrl: uploaded.url, caption: variation.body, dryRun: false });
  log('IG publish-test:', JSON.stringify(ig));
  if (CHANNELS.includes('linkedin')) {
    const li = await linkedin.publishText({ text: variation.body, imagePath, dryRun: false });
    log('LinkedIn publish-test:', JSON.stringify(li));
  }
}

function log(...args) {
  console.log('[post-automation]', ...args);
}

main().catch(async (err) => {
  console.error('[post-automation] ERRO:', err);
  try {
    await notify(`🚨 Geração falhou: ${err.message}`, { dryRun: DRY_RUN });
  } catch (_) {}
  process.exit(1);
});
