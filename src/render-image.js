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
    hero: 'templates/instagram/hero.html',
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
    brand: vars.brand || 'Pilar',
    handle: vars.handle || '@pilar.software',
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
    // undefined não pode apagar o padrão (o carrossel repassa brand/handle opcionais)
    ...Object.fromEntries(Object.entries(vars).filter(([, v]) => v !== undefined)),
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

async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

// Renderiza num navegador já aberto (o carrossel reusa um só pra todos os slides).
async function renderWithBrowser(browser, { channel, pillar, vars, outPath }) {
  if (!DIMENSIONS[channel]) throw new Error(`Canal desconhecido pra render: ${channel}`);

  const templateFile = resolveTemplate(channel, pillar);
  if (!existsSync(templateFile)) {
    throw new Error(`Template não encontrado: ${templateFile}`);
  }

  const template = await readFile(templateFile, 'utf8');
  const html = applyVars(template, vars || {}, pillar);

  if (!existsSync(TMP_DIR)) await mkdir(TMP_DIR, { recursive: true });
  const finalOut = outPath || path.join(TMP_DIR, `${channel}-${pillar}-${Date.now()}.png`);

  const page = await browser.newPage();
  try {
    const { width, height } = DIMENSIONS[channel];
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: finalOut, type: 'png', clip: { x: 0, y: 0, width, height } });
    return finalOut;
  } finally {
    await page.close();
  }
}

export async function renderImage({ channel, pillar, vars, outPath }) {
  const browser = await launchBrowser();
  try {
    return await renderWithBrowser(browser, { channel, pillar, vars, outPath });
  } finally {
    await browser.close();
  }
}

export function slideVars(slide, i, total, { brand, handle } = {}) {
  const isText = typeof slide === 'string';
  const title = isText ? slide : (slide?.title || '');
  const description = isText ? '' : (slide?.description || '');
  return { step: `${i + 1}/${total}`, title, description, hook: title, body: description, brand, handle };
}

// Slides do carrossel sempre no desenho vertical do Instagram (1080x1350): o mesmo
// PNG serve o carrossel do IG e as páginas do PDF do LinkedIn.
export async function renderCarousel({ pillar, slides, brand, handle, slideChannel = 'instagram' }) {
  const out = [];
  const stamp = Date.now();
  const browser = await launchBrowser();
  try {
    for (let i = 0; i < slides.length; i += 1) {
      const vars = slideVars(slides[i], i, slides.length, { brand, handle });
      const outPath = path.join(TMP_DIR, `${slideChannel}-${pillar}-carousel-${stamp}-${i}.png`);
      out.push(await renderWithBrowser(browser, { channel: slideChannel, pillar, vars, outPath }));
    }
  } finally {
    await browser.close();
  }
  return out;
}

// Uma página por imagem, no tamanho exato do slide. Pura (testável).
export function buildPdfHtml(imageDataUrls, { width, height }) {
  const pages = imageDataUrls
    .map(src => `<div class="page"><img src="${src}" /></div>`)
    .join('');
  return `<!doctype html><html><head><style>
@page { size: ${width}px ${height}px; margin: 0; }
* { margin: 0; padding: 0; }
.page { width: ${width}px; height: ${height}px; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
img { width: ${width}px; height: ${height}px; display: block; }
</style></head><body>${pages}</body></html>`;
}

// PDF dos slides já renderizados: é o "carrossel" do LinkedIn (post de documento).
export async function renderPdf({ imagePaths, outPath, slideChannel = 'instagram' }) {
  if (!imagePaths?.length) throw new Error('PDF sem slides');
  const { width, height } = DIMENSIONS[slideChannel];
  const dataUrls = [];
  for (const file of imagePaths) {
    dataUrls.push(`data:image/png;base64,${(await readFile(file)).toString('base64')}`);
  }
  if (!existsSync(TMP_DIR)) await mkdir(TMP_DIR, { recursive: true });
  const finalOut = outPath || path.join(TMP_DIR, `carousel-${Date.now()}.pdf`);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(buildPdfHtml(dataUrls, { width, height }), { waitUntil: 'load' });
    await page.pdf({ path: finalOut, width: `${width}px`, height: `${height}px`, printBackground: true, pageRanges: '' });
    return finalOut;
  } finally {
    await browser.close();
  }
}

export const _internal = { applyVars, resolveTemplate, DIMENSIONS, buildPdfHtml, slideVars };
