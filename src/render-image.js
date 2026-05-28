// render-image.js — renderiza template HTML em PNG via Puppeteer.
// Chamado por: src/index.js, src/channels/*. Lê templates/.

import puppeteer from 'puppeteer';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, 'tmp');

const DIMENSIONS = {
  instagram: { width: 1080, height: 1350 },
  linkedin: { width: 1200, height: 627 },
};

const TEMPLATE_MAP = {
  instagram: {
    dor: 'templates/instagram/dor.html',
    dica: 'templates/instagram/dica.html',
    citacao: 'templates/instagram/citacao.html',
    stat: 'templates/instagram/stat.html',
    anuncio: 'templates/instagram/anuncio.html',
    building: 'templates/instagram/building.html',
    prova: 'templates/instagram/prova.html',
  },
  linkedin: {
    dor: 'templates/linkedin/single.html',
    dica: 'templates/linkedin/single.html',
    building: 'templates/linkedin/single.html',
    prova: 'templates/linkedin/single.html',
    citacao: 'templates/linkedin/single.html',
    stat: 'templates/linkedin/single.html',
    anuncio: 'templates/linkedin/single.html',
  },
};

function resolveTemplate(channel, pillar) {
  const mapping = TEMPLATE_MAP[channel] || {};
  const rel = mapping[pillar] || mapping.dor;
  return path.join(ROOT, rel);
}

const BADGE_BY_PILLAR = {
  dor: 'DOR REAL',
  dica: 'DICA PRÁTICA',
  building: 'BUILDING IN PUBLIC',
  prova: 'CLIENTE REAL',
  citacao: 'CITAÇÃO',
  stat: 'NÚMERO',
  anuncio: 'NOVIDADE',
};

function applyVars(html, vars, pillar) {
  let out = html;
  const merged = {
    brand: vars.brand || 'SaaS Engenharia',
    handle: vars.handle || '@seu_handle',
    badge: vars.badge || BADGE_BY_PILLAR[pillar] || 'DOR REAL',
    hook: vars.hook || '',
    subline: vars.subline || vars.body || '',
    step: vars.step || 'DICA',
    title: vars.title || vars.hook || '',
    description: vars.description || vars.body || '',
    quote: vars.quote || vars.hook || '',
    attribution: vars.attribution || 'cliente real',
    label: vars.label || 'NÚMERO',
    number: vars.number || '0',
    unit: vars.unit || '',
    eyebrow: vars.eyebrow || 'NOVO',
    subtitle: vars.subtitle || vars.body || '',
    cta: vars.cta || 'Saiba mais',
    ...vars,
  };
  for (const [key, value] of Object.entries(merged)) {
    out = out.replaceAll(`{{${key}}}`, escapeHtml(String(value)));
  }
  return out;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderImage({ channel, pillar, vars, outPath }) {
  if (!DIMENSIONS[channel]) throw new Error(`Canal desconhecido pra render: ${channel}`);

  const templateFile = resolveTemplate(channel, pillar);
  if (!existsSync(templateFile)) {
    throw new Error(`Template não encontrado: ${templateFile}`);
  }

  const template = await readFile(templateFile, 'utf8');
  const html = applyVars(template, vars || {}, pillar);

  if (!existsSync(TMP_DIR)) await mkdir(TMP_DIR, { recursive: true });
  const finalOut = outPath || path.join(TMP_DIR, `${channel}-${pillar}-${Date.now()}.png`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    const { width, height } = DIMENSIONS[channel];
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: finalOut, type: 'png', clip: { x: 0, y: 0, width, height } });
    return finalOut;
  } finally {
    await browser.close();
  }
}

export async function renderCarousel({ channel, pillar, slides, brand, handle }) {
  const out = [];
  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    const vars = {
      step: `${i + 1}/${slides.length}`,
      title: typeof slide === 'string' ? slide : slide.title,
      description: typeof slide === 'string' ? '' : (slide.description || ''),
      hook: typeof slide === 'string' ? slide : slide.title,
      body: typeof slide === 'string' ? '' : (slide.description || ''),
      brand,
      handle,
    };
    const outPath = path.join(TMP_DIR, `${channel}-${pillar}-carousel-${Date.now()}-${i}.png`);
    const file = await renderImage({ channel, pillar, vars, outPath });
    out.push(file);
  }
  return out;
}

export const _internal = { applyVars, resolveTemplate, DIMENSIONS };
