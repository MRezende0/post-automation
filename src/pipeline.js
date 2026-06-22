// pipeline.js — lógica de geração, renderização e publicação compartilhada
// entre a fase GERAR (index.js) e a fase RESOLVER (resolve.js).

import { readFile } from 'node:fs/promises';
import { generatePost, judgeVariations, critiqueVariations, polishPost, checkGuardrails, composeCaption } from './generate.js';
import { resolveTenant } from './tenant.js';
import { renderImage, renderCarousel } from './render-image.js';
import { rankVariations } from './utils/ranking.js';
import { uploadImage } from './utils/storage.js';
import { generateBackground, SCENE_BY_PILLAR, pickScenes } from './utils/image-gen.js';
import * as instagram from './channels/instagram.js';
import * as linkedin from './channels/linkedin.js';

const DRY_RUN = process.env.DRY_RUN === 'true';
const IMAGE_BG = process.env.IMAGE_BG === 'true'; // híbrido: fundo IA + texto via template

// Híbrido: gera ilustração de fundo (nano banana) e sobrepõe o hook via template hero.
// Só Instagram, best-effort — se a geração falhar, devolve null (cai no card normal).
async function renderHero({ channel, pillar, variation, scene, tenant }) {
  if (channel !== 'instagram') return null;
  try {
    const chosenScene = scene || SCENE_BY_PILLAR[pillar] || SCENE_BY_PILLAR.default;
    const bgPath = await generateBackground({ scene: chosenScene });
    if (!bgPath) return null;
    const bg = `data:image/png;base64,${(await readFile(bgPath)).toString('base64')}`;
    return await renderImage({
      channel,
      pillar: 'hero',
      vars: { bg, badge: tenant.badges[pillar] || 'PILAR', hook: variation.hook },
    });
  } catch (e) {
    log(`Falha hero ${channel}/${pillar}: ${e.message}`);
    return null;
  }
}

function log(...args) {
  console.log('[pipeline]', ...args);
}

// Renderiza o card de preview de uma variação (single image ilustrativa).
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

// Gera as 3 variações, elege o top-1 (LLM-judge com fallback heurístico) e
// renderiza+sobe uma imagem PRA CADA variação — assim o preview mostra a imagem
// real de cada opção e a publicação não precisa re-renderizar a escolhida.
export async function prepareGeneration({ channel, seed, regenNote, tenant = resolveTenant() }) {
  const context = [seed.context, regenNote].filter(Boolean).join('\n\n') || undefined;
  const generation = await generatePost({
    channel,
    pillar: seed.pillar,
    angle: seed.angle,
    context,
    dryRun: DRY_RUN,
    tenant,
  });
  log(`Gerou ${generation.variations.length} variações | pilar=${generation.pillar} | ângulo=${generation.angle}`);

  const ranked = rankVariations(generation.variations);
  let topId = ranked[0].variation.id;
  let how = `heurística (score ${ranked[0].score})`;
  // Scores heurísticos por variação → persistidos em post_variants (observabilidade).
  generation.heuristic_scores = Object.fromEntries(ranked.map(r => [r.variation.id, r.score]));
  if (!DRY_RUN) {
    // Agente Crítico: derruba variações fracas ANTES do judge (eleva o piso).
    let candidates = generation.variations;
    const critique = await critiqueVariations({ channel, pillar: generation.pillar, variations: generation.variations, tenant });
    if (Array.isArray(critique)) {
      generation.critic = critique;
      const survivors = generation.variations.filter(v => !critique.find(c => c.id === v.id)?.refuted);
      if (survivors.length) candidates = survivors; // se todos refutados, mantém todos
      log(`Crítico: ${candidates.length}/${generation.variations.length} sobreviveram`);
    }
    // Judge multidimensional escolhe entre os sobreviventes.
    const verdict = await judgeVariations({ channel, pillar: generation.pillar, variations: candidates, tenant });
    if (verdict) {
      topId = verdict.chosenId;
      how = `judge ${verdict.reason}`;
      generation.judge_reason = verdict.reason;
      generation.judge_scores = verdict.scores;
    }
  }
  log(`Top-1: variação #${topId} via ${how}`);

  // Auto-edição: o editor refina o top-1 aplicando o checklist de voz, e os
  // guardrails sinalizam o que escapou (buzzword, fora-ICP, número em prova).
  if (!DRY_RUN) {
    const top = generation.variations.find(v => v.id === topId);
    if (top) {
      const polished = await polishPost({ channel, pillar: generation.pillar, variation: top, tenant });
      Object.assign(top, { hook: polished.hook, body: polished.body }); // muta a ref no array
      const guard = checkGuardrails(top, { pillar: generation.pillar, tenant });
      generation.guardrail_flags = guard.flags;
      log(guard.clean ? 'Guardrails: ok' : `⚠️ Guardrails (top #${topId}): ${guard.flags.join(', ')}`);
    }
  }

  // 3 artes VISUALMENTE DISTINTAS: cada variação ganha uma cena de IA diferente
  // (antes só a top ganhava arte de IA; as outras caíam no mesmo template → pareciam iguais).
  const scenes = pickScenes(generation.pillar, generation.variations.length);
  const images = [];
  for (let i = 0; i < generation.variations.length; i += 1) {
    const v = generation.variations[i];
    let imagePath = null;
    if (IMAGE_BG && !DRY_RUN) {
      imagePath = await renderHero({ channel, pillar: generation.pillar, variation: v, scene: scenes[i], tenant });
    }
    if (!imagePath) imagePath = await renderPreview({ channel, pillar: generation.pillar, variation: v });
    if (imagePath && !DRY_RUN) {
      const uploaded = await uploadImage(imagePath);
      images.push({ id: v.id, url: uploaded.url });
      log(`Imagem variação #${v.id}: ${uploaded.url}`);
    } else if (imagePath) {
      images.push({ id: v.id, url: null, path: imagePath });
    }
  }

  return { generation, topId, images };
}

// Renderiza cada slide do carrossel e sobe pro storage, retornando as URLs.
async function buildCarouselUrls({ channel, pillar, variation }) {
  const files = await renderCarousel({ channel, pillar, slides: variation.slides || [] });
  const urls = [];
  for (const file of files) {
    const uploaded = await uploadImage(file);
    urls.push(uploaded.url);
  }
  return urls;
}

export async function publishToChannel({ channel, variation, imageUrl, pillar }) {
  const caption = composeCaption(variation); // corpo + hashtags estruturadas
  if (channel === 'instagram') {
    if (variation.format === 'carousel' && variation.slides?.length) {
      if (DRY_RUN) {
        return instagram.publishCarousel({ imageUrls: variation.slides, caption, dryRun: true });
      }
      const imageUrls = variation.slideUrls?.length
        ? variation.slideUrls
        : await buildCarouselUrls({ channel, pillar, variation });
      log(`Carousel ${channel}: ${imageUrls.length} slides renderizados/enviados`);
      return instagram.publishCarousel({ imageUrls, caption, dryRun: false });
    }
    const used = variation.imageUrl || imageUrl;
    const r = await instagram.publishSingle({ imageUrl: used, caption, dryRun: DRY_RUN });
    return { ...r, imageUrl: used };
  }
  if (channel === 'linkedin') {
    const r = await linkedin.publishText({ text: caption, imageUrl, dryRun: DRY_RUN });
    return { ...r, imageUrl: imageUrl || null };
  }
  throw new Error(`Canal desconhecido: ${channel}`);
}

export { renderPreview };
