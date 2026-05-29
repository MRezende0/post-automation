// image-gen.js — gera ILUSTRAÇÃO DE FUNDO via Gemini 2.5 Flash Image ("nano banana").
// Estilo travado na identidade Pilar e SEM texto — o hook é sobreposto depois pelo
// template HTML (render-image.js, template hero). Assim: visual rico + texto perfeito + marca.
//
// Chamado por: src/pipeline.js (quando IMAGE_BG=true). Best-effort: erro → null.

import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const MODEL = 'gemini-2.5-flash-image';
const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, 'tmp');

// Style guide fixo — garante coerência de marca entre imagens.
const STYLE = [
  'Minimalist editorial illustration, flat vector style.',
  'Off-white paper background (#FCFCFC).',
  'Line work in ink (#1A1A1A) and lime-green accent (#A4EC86).',
  'Generous negative space, clean and professional, B2B tone.',
  'Square 1:1 composition.',
  'ABSOLUTELY NO text, NO words, NO letters, NO numbers, NO logos.',
].join(' ');

// Cena (metáfora visual) por pilar — sem texto. O pipeline escolhe pela rotação.
export const SCENE_BY_PILLAR = {
  dor: 'an overwhelmed engineer sitting on the floor, surrounded by a towering pile of paper spreadsheets and documents',
  dica: 'a calm engineer organizing project cards into neat columns on a clean board, a tidy checklist',
  building: 'hands assembling building blocks into a strong column/pillar on a workbench, a blueprint nearby',
  prova: 'a confident engineer reviewing a clear rising performance chart on a tidy desk',
  default: 'an organized engineering office desk with rolled blueprints and a laptop, calm and minimal',
};

// Variantes de cena por pilar — pra gerar 3 artes VISUALMENTE DISTINTAS por post
// (cada variação ganha uma cena diferente, não o mesmo template).
export const SCENES_BY_PILLAR = {
  dor: [
    'an overwhelmed engineer sitting on the floor surrounded by a towering pile of paper spreadsheets',
    'a tangled mess of project folders and revision stamps scattered across a desk at night',
    'an engineer with hands on head, drowning under floating documents and version labels',
    'a clock striking midnight beside an open laptop and unsorted stacks of blueprints',
  ],
  dica: [
    'a calm engineer organizing project cards into neat columns on a clean board',
    'a tidy checklist with green checkmarks beside a simple kanban board',
    'hands sorting blueprints into labeled folders, orderly and minimal',
    'a clean desk with a single organized planner, one pen, a cup of coffee',
  ],
  building: [
    'hands assembling building blocks into a strong column on a workbench, a blueprint nearby',
    'a partially built pillar with light scaffolding, an upward growth metaphor',
    'an open notebook with sketches of a product roadmap beside a small prototype',
    'stacked blocks forming an upward staircase toward a small flag',
  ],
  prova: [
    'a confident engineer reviewing a clear rising performance chart on a tidy desk',
    'a firm handshake over a finished blueprint, trust and delivery',
    'a satisfied client nodding at a clean dashboard on a monitor',
    'a rising bar chart with a single checkmark, minimal and clean',
  ],
  default: [
    'an organized engineering office desk with rolled blueprints and a laptop, calm and minimal',
    'a minimalist workspace with a single monitor and tidy supplies',
  ],
};

// Escolhe n cenas distintas pro pilar (cicla se houver menos que n). Pura (testável).
export function pickScenes(pillar, n) {
  const pool = SCENES_BY_PILLAR[pillar] || SCENES_BY_PILLAR.default;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(pool[i % pool.length]);
  return out;
}

// Monta um prompt de cena a partir do post. `scene` é uma descrição visual curta
// (metáfora da dor/tema); evita citar texto a ser escrito.
export function buildImagePrompt(scene) {
  return `${STYLE}\nSubject: ${scene}`;
}

export async function generateBackground({ scene, outPath } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !scene) return null;
  const client = new GoogleGenAI({ apiKey });

  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildImagePrompt(scene),
    });
    const parts = res.candidates?.[0]?.content?.parts || [];
    const img = parts.find(p => p.inlineData);
    if (!img) return null;

    if (!existsSync(TMP_DIR)) await mkdir(TMP_DIR, { recursive: true });
    const file = outPath || path.join(TMP_DIR, `bg-${Date.now()}.png`);
    await writeFile(file, Buffer.from(img.inlineData.data, 'base64'));
    return file;
  } catch (e) {
    return null;
  }
}

export const _internal = { STYLE, MODEL, buildImagePrompt };
