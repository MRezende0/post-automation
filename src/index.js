// index.js — entrypoint do workflow post.yml. Orquestra geração, aprovação e publicação.
// Chamado por: .github/workflows/post.yml. Flags via env: DRY_RUN, PUBLISH_TEST, SKIP_APPROVAL.

import 'dotenv/config';
import { generatePost, judgeVariations } from './generate.js';
import { renderImage, renderCarousel } from './render-image.js';
import { popNext, markPublished, markRejected, getQueue, loadPending, savePending, clearPending, expirePending } from './utils/queue.js';
import { rankVariations } from './utils/ranking.js';
import { uploadImage } from './utils/storage.js';
import * as instagram from './channels/instagram.js';
import * as linkedin from './channels/linkedin.js';
import { sendApprovalRequest, waitForDecision, notify } from './telegram.js';
import { getUpcomingHoliday, holidayContext } from './utils/holidays.js';

const DRY_RUN = process.env.DRY_RUN === 'true';
const PUBLISH_TEST = process.env.PUBLISH_TEST === 'true';
const SKIP_APPROVAL = process.env.SKIP_APPROVAL === 'true' || DRY_RUN;
const HOLIDAY_AWARE = process.env.HOLIDAY_AWARE !== 'false';
const HOLIDAY_WINDOW_DAYS = Number(process.env.HOLIDAY_WINDOW_DAYS || 7);
const MAX_REGEN = Number(process.env.MAX_REGEN || 3);

const CHANNELS = (process.env.CHANNELS || 'instagram').split(',').map(s => s.trim());

async function main() {
  log(`Iniciando run | DRY_RUN=${DRY_RUN} | PUBLISH_TEST=${PUBLISH_TEST} | SKIP_APPROVAL=${SKIP_APPROVAL}`);

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

  // Sem item forçado na fila, um feriado próximo tem prioridade sobre a rotação normal.
  if (HOLIDAY_AWARE && !seed.pillar) {
    const holiday = getUpcomingHoliday(new Date(), HOLIDAY_WINDOW_DAYS);
    if (holiday) {
      seed.pillar = holiday.pillar;
      seed.angle = holiday.angle;
      seed.context = [seed.context, holidayContext(holiday)].filter(Boolean).join('\n\n');
      log(`Feriado em ${holiday.daysUntil}d → post temático: ${holiday.name} (pilar=${holiday.pillar}, ângulo=${holiday.angle})`);
    }
  }

  const results = {};
  let lastPublished = null;

  for (const channel of CHANNELS) {
    log(`\n=== Canal: ${channel} ===`);

    const pending = await loadPending(channel);
    let generation;
    let topId;
    let imagePath;
    let imageUrl;
    let channelSeed = seed;

    if (pending) {
      log(`Retomando pending salvo em ${pending.saved_at}`);
      await notify(`🔁 Retomando post ${channel} pendente desde ${pending.saved_at}`, { dryRun: DRY_RUN }).catch(() => {});
      generation = pending.generation;
      topId = pending.top_id;
      imageUrl = pending.image_url;
      channelSeed = pending.seed || seed;
    } else {
      generation = await generatePost({
        channel,
        pillar: seed.pillar,
        angle: seed.angle,
        context: seed.context,
        dryRun: DRY_RUN,
      });
      log(`Gerou ${generation.variations.length} variações | pilar=${generation.pillar} | ângulo=${generation.angle}`);
      const ranked = rankVariations(generation.variations);
      topId = ranked[0].variation.id;
      log(`Top-1 por heurística: variação #${topId} (score ${ranked[0].score})`);
      const top = generation.variations.find(v => v.id === topId);
      imagePath = await renderPreview({ channel, pillar: generation.pillar, variation: top });
      if (imagePath && !DRY_RUN) {
        const uploaded = await uploadImage(imagePath);
        imageUrl = uploaded.url;
        log(`Imagem publicada: ${imageUrl}`);
      }
    }

    let chosenId = topId;
    let action = 'approve';

    if (!SKIP_APPROVAL) {
      const { messageId, botInstance } = await sendApprovalRequest({
        channel,
        pillar: generation.pillar,
        angle: generation.angle,
        variations: generation.variations,
        imagePath,
        imageUrl,
      });
      log(`Enviou preview Telegram (msg=${messageId}), aguardando decisão...`);

      const decision = await waitForDecision({ botInstance, messageId });
      action = decision.action;
      chosenId = decision.chosenId || topId;
      log(`Decisão: ${action} (variação ${chosenId}${decision.reason ? ' | motivo: ' + decision.reason : ''})`);

      if (action === 'reject') {
        await clearPending(channel);
        await markRejected({ ...channelSeed, channel, generation }, decision.reason);
        await notify(`❌ Post ${channel} rejeitado: ${decision.reason}`, { dryRun: DRY_RUN });
        continue;
      }
      if (action === 'regen') {
        await clearPending(channel);
        await notify(`🔄 Regenerar ${channel} ficou pra próximo run (não implementado em loop)`, { dryRun: DRY_RUN });
        continue;
      }
      if (action === 'timeout') {
        await savePending({ channel, generation, top_id: topId, image_url: imageUrl, seed: channelSeed });
        await notify(`⏱️ Post ${channel} sem decisão — salvo pra retomar no próximo run (TTL 7d)`, { dryRun: DRY_RUN });
        continue;
      }
      if (action !== 'approve') {
        await savePending({ channel, generation, top_id: topId, image_url: imageUrl, seed: channelSeed });
        await notify(`⚠️ Ação desconhecida (${action}) em ${channel} — salvo pra retomar`, { dryRun: DRY_RUN });
        continue;
      }
    }

    const chosen = generation.variations.find(v => v.id === chosenId);
    let finalImageUrl = imageUrl;
    if (chosen.id !== topId && !DRY_RUN) {
      const newImg = await renderPreview({ channel, pillar: generation.pillar, variation: chosen });
      if (newImg) {
        const uploaded = await uploadImage(newImg);
        finalImageUrl = uploaded.url;
        log(`Reimagem variação ${chosen.id}: ${finalImageUrl}`);
      }
    }

    const publishResult = await publishToChannel({ channel, variation: chosen, imageUrl: finalImageUrl });
    log(`Publicou em ${channel}: ${JSON.stringify(publishResult)}`);

    await clearPending(channel);
    results[channel] = { variationId: chosen.id, ...publishResult };
    lastPublished = {
      pillar: generation.pillar,
      angle: generation.angle,
      post: { hook: chosen.hook, body: chosen.body, format: chosen.format },
    };
  }

  if (Object.keys(results).length > 0) {
    await markPublished(
      { ...seed, ...lastPublished, generated_at: new Date().toISOString() },
      { chosenVariationId: results.instagram?.variationId || results.linkedin?.variationId, channels: results },
    );
    if (!DRY_RUN) {
      await notify(`✅ Publicado em: ${Object.keys(results).join(', ')}`, { dryRun: DRY_RUN });
    }
  }

  log('\nFim do run.');
}

// Gera variações, escolhe o top-1 (LLM-judge com fallback heurístico),
// renderiza o preview e sobe a imagem. Reutilizável a cada regeneração.
async function prepareGeneration({ channel, seed, regenNote }) {
  const context = [seed.context, regenNote].filter(Boolean).join('\n\n') || undefined;
  const generation = await generatePost({
    channel,
    pillar: seed.pillar,
    angle: seed.angle,
    context,
    dryRun: DRY_RUN,
  });
  log(`Gerou ${generation.variations.length} variações | pilar=${generation.pillar} | ângulo=${generation.angle}`);

  const ranked = rankVariations(generation.variations);
  let topId = ranked[0].variation.id;
  let how = `heurística (score ${ranked[0].score})`;
  if (!DRY_RUN) {
    const verdict = await judgeVariations({ channel, pillar: generation.pillar, variations: generation.variations });
    if (verdict) {
      topId = verdict.chosenId;
      how = `LLM-judge (${verdict.reason})`;
    }
  }
  log(`Top-1: variação #${topId} via ${how}`);

  const top = generation.variations.find(v => v.id === topId);
  const imagePath = await renderPreview({ channel, pillar: generation.pillar, variation: top });
  let imageUrl;
  if (imagePath && !DRY_RUN) {
    const uploaded = await uploadImage(imagePath);
    imageUrl = uploaded.url;
    log(`Imagem publicada: ${imageUrl}`);
  }
  return { generation, topId, imagePath, imageUrl };
}

async function renderPreview({ channel, pillar, variation }) {
  try {
    return await renderImage({
      channel,
      pillar,
      vars: {
        hook: variation.hook,
        body: variation.body,
        subline: variation.body?.split('\n').slice(1).join(' ').slice(0, 200),
        title: variation.hook,
        description: variation.body?.slice(0, 280),
        quote: variation.hook,
      },
    });
  } catch (e) {
    log(`Falha render imagem ${channel}/${pillar}: ${e.message}`);
    return null;
  }
}

// Renderiza cada slide do carrossel em PNG e sobe pro storage público,
// retornando as URLs na ordem. Em dry-run, não renderiza nem sobe.
async function buildCarouselUrls({ channel, pillar, variation }) {
  const files = await renderCarousel({ channel, pillar, slides: variation.slides || [] });
  const urls = [];
  for (const file of files) {
    const uploaded = await uploadImage(file);
    urls.push(uploaded.url);
  }
  return urls;
}

async function publishToChannel({ channel, variation, imageUrl, pillar }) {
  if (channel === 'instagram') {
    if (variation.format === 'carousel' && variation.slides?.length) {
      if (DRY_RUN) {
        return instagram.publishCarousel({ imageUrls: variation.slides, caption: variation.body, dryRun: true });
      }
      const imageUrls = variation.slideUrls?.length
        ? variation.slideUrls
        : await buildCarouselUrls({ channel, pillar, variation });
      log(`Carousel ${channel}: ${imageUrls.length} slides renderizados/enviados`);
      return instagram.publishCarousel({ imageUrls, caption: variation.body, dryRun: false });
    }
    return instagram.publishSingle({
      imageUrl: variation.imageUrl || imageUrl,
      caption: variation.body,
      dryRun: DRY_RUN,
    });
  }
  if (channel === 'linkedin') {
    return linkedin.publishText({
      text: variation.body,
      imageUrl,
      dryRun: DRY_RUN,
    });
  }
  throw new Error(`Canal desconhecido: ${channel}`);
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
  const ig = await instagram.publishSingle({
    imageUrl: uploaded.url,
    caption: variation.body,
    dryRun: false,
  });
  log('IG publish-test:', JSON.stringify(ig));
  if (CHANNELS.includes('linkedin')) {
    const li = await linkedin.publishText({
      text: variation.body,
      imagePath,
      dryRun: false,
    });
    log('LinkedIn publish-test:', JSON.stringify(li));
  }
}

function log(...args) {
  console.log('[post-automation]', ...args);
}

main().catch(async (err) => {
  console.error('[post-automation] ERRO:', err);
  try {
    await notify(`🚨 Run falhou: ${err.message}`, { dryRun: DRY_RUN });
  } catch (_) {}
  process.exit(1);
});
