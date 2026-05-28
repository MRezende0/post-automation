// index.js — entrypoint do workflow post.yml. Orquestra geração, aprovação e publicação.
// Chamado por: .github/workflows/post.yml. Flags via env: DRY_RUN, PUBLISH_TEST, SKIP_APPROVAL.

import 'dotenv/config';
import { generatePost } from './generate.js';
import { renderImage } from './render-image.js';
import { popNext, markPublished, markRejected, getQueue } from './utils/queue.js';
import { rankVariations } from './utils/ranking.js';
import { uploadImage } from './utils/storage.js';
import * as instagram from './channels/instagram.js';
import * as linkedin from './channels/linkedin.js';
import { sendApprovalRequest, waitForDecision, notify } from './telegram.js';

const DRY_RUN = process.env.DRY_RUN === 'true';
const PUBLISH_TEST = process.env.PUBLISH_TEST === 'true';
const SKIP_APPROVAL = process.env.SKIP_APPROVAL === 'true' || DRY_RUN;

const CHANNELS = (process.env.CHANNELS || 'instagram').split(',').map(s => s.trim());

async function main() {
  log(`Iniciando run | DRY_RUN=${DRY_RUN} | PUBLISH_TEST=${PUBLISH_TEST} | SKIP_APPROVAL=${SKIP_APPROVAL}`);

  if (PUBLISH_TEST) {
    return runPublishTest();
  }

  const queueItem = await popNext();
  const seed = queueItem || {};
  log(`Item da fila: ${queueItem ? JSON.stringify(queueItem) : 'vazio, gera automático'}`);

  const results = {};

  for (const channel of CHANNELS) {
    log(`\n=== Canal: ${channel} ===`);

    const generation = await generatePost({
      channel,
      pillar: seed.pillar,
      angle: seed.angle,
      context: seed.context,
      dryRun: DRY_RUN,
    });

    log(`Gerou ${generation.variations.length} variações | pilar=${generation.pillar} | ângulo=${generation.angle}`);

    const ranked = rankVariations(generation.variations);
    const topId = ranked[0].variation.id;
    log(`Top-1 por heurística: variação #${topId} (score ${ranked[0].score})`);

    const top = generation.variations.find(v => v.id === topId);
    const imagePath = await renderPreview({ channel, pillar: generation.pillar, variation: top });

    let chosenId = topId;
    let action = 'approve';

    if (!SKIP_APPROVAL) {
      const { messageId, botInstance } = await sendApprovalRequest({
        channel,
        pillar: generation.pillar,
        angle: generation.angle,
        variations: generation.variations,
        imagePath,
      });
      log(`Enviou preview Telegram (msg=${messageId}), aguardando decisão...`);

      const decision = await waitForDecision({ botInstance, messageId });
      action = decision.action;
      chosenId = decision.chosenId || topId;
      log(`Decisão: ${action} (variação ${chosenId}${decision.reason ? ' | motivo: ' + decision.reason : ''})`);

      if (action === 'reject') {
        await markRejected({ ...seed, channel, generation }, decision.reason);
        await notify(`❌ Post ${channel} rejeitado: ${decision.reason}`, { dryRun: DRY_RUN });
        continue;
      }
      if (action === 'regen') {
        await notify(`🔄 Regenerar ${channel} ficou pra próximo run (não implementado em loop)`, { dryRun: DRY_RUN });
        continue;
      }
    }

    const chosen = generation.variations.find(v => v.id === chosenId);
    let finalImage = imagePath;
    if (chosen.id !== top.id) {
      finalImage = await renderPreview({ channel, pillar: generation.pillar, variation: chosen });
    }

    const publishResult = await publishToChannel({ channel, variation: chosen, imagePath: finalImage });
    log(`Publicou em ${channel}: ${JSON.stringify(publishResult)}`);

    results[channel] = { variationId: chosen.id, ...publishResult };
  }

  if (Object.keys(results).length > 0) {
    await markPublished(
      { ...seed, generated_at: new Date().toISOString() },
      { chosenVariationId: results.instagram?.variationId || results.linkedin?.variationId, channels: results },
    );
    if (!DRY_RUN) {
      await notify(`✅ Publicado em: ${Object.keys(results).join(', ')}`, { dryRun: DRY_RUN });
    }
  }

  log('\nFim do run.');
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

async function publishToChannel({ channel, variation, imagePath }) {
  if (channel === 'instagram') {
    if (variation.format === 'carousel' && variation.slides) {
      return instagram.publishCarousel({
        imageUrls: variation.slideUrls || [],
        caption: variation.body,
        dryRun: DRY_RUN,
      });
    }
    let imageUrl = variation.imageUrl;
    if (!imageUrl && imagePath && !DRY_RUN) {
      const uploaded = await uploadImage(imagePath);
      imageUrl = uploaded.url;
      log(`Imagem publicada: ${imageUrl}`);
    }
    return instagram.publishSingle({
      imageUrl: imageUrl || `file://${imagePath}`,
      caption: variation.body,
      dryRun: DRY_RUN,
    });
  }
  if (channel === 'linkedin') {
    return linkedin.publishText({
      text: variation.body,
      imagePath,
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
