// generate.js — gera 3 variações de post via Gemini API com few-shot.
// Chamado por: src/index.js. Lê: docs/, prompts/, content/examples/.

import { GoogleGenAI } from '@google/genai';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chooseNextPillar, chooseNextAngle } from './utils/ranking.js';
import { getPublished } from './utils/queue.js';

const MODEL_GENERATE = 'gemini-2.5-pro';
const MODEL_SIMPLE = 'gemini-2.5-flash';

const ROOT = process.cwd();

async function readDoc(rel) {
  const file = path.join(ROOT, rel);
  if (!existsSync(file)) return '';
  return readFile(file, 'utf8');
}

async function loadSystemPrompt() {
  const template = await readDoc('prompts/system.md');
  const replacements = {
    '{{ICP}}': await readDoc('docs/icp.md'),
    '{{POSICIONAMENTO}}': await readDoc('docs/posicionamento.md'),
    '{{VOICE}}': await readDoc('docs/voice.md'),
    '{{PILARES}}': await readDoc('docs/pilares.md'),
    '{{DORES}}': await readDoc('docs/dores.md'),
  };
  let prompt = template;
  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replace(key, value);
  }
  return prompt;
}

async function loadChannelPrompt(channel) {
  return readDoc(`prompts/channels/${channel}.md`);
}

async function loadPillarPrompt(pillar) {
  return readDoc(`prompts/pillars/${pillar}.md`);
}

async function loadExamples() {
  const dir = path.join(ROOT, 'content/examples/high-performers');
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  const examples = [];
  for (const f of files) {
    if (f.endsWith('.md') || f.endsWith('.txt')) {
      const content = await readFile(path.join(dir, f), 'utf8');
      examples.push({ name: f, content });
    }
  }
  return examples;
}

function buildFewShot(examples) {
  if (examples.length === 0) return '';
  const blocks = examples
    .slice(0, 6)
    .map((ex, i) => `### Exemplo ${i + 1} (${ex.name})\n${ex.content}`)
    .join('\n\n');
  return `\n\n## Exemplos de posts que performaram bem (use como referência de tom e estrutura)\n\n${blocks}`;
}

export async function generatePost({ channel, pillar, angle, context, dryRun = false }) {
  if (!['instagram', 'linkedin'].includes(channel)) {
    throw new Error(`Canal inválido: ${channel}`);
  }

  let chosenPillar = pillar;
  let chosenAngle = angle;
  if (!chosenPillar) {
    const published = await getPublished();
    chosenPillar = chooseNextPillar(published);
    chosenAngle = chooseNextAngle(chosenPillar, published);
  }

  if (dryRun) {
    return mockGeneration({ channel, pillar: chosenPillar, angle: chosenAngle });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada. Use DRY_RUN=true pra testar sem API.');
  }

  const client = new GoogleGenAI({ apiKey });

  const [systemBase, channelPrompt, pillarPrompt, examples] = await Promise.all([
    loadSystemPrompt(),
    loadChannelPrompt(channel),
    loadPillarPrompt(chosenPillar),
    loadExamples(),
  ]);

  const system = [
    systemBase,
    `## Canal alvo: ${channel}`,
    channelPrompt,
    `## Pilar alvo: ${chosenPillar}`,
    pillarPrompt,
    buildFewShot(examples),
  ].join('\n\n---\n\n');

  const userMessage = buildUserMessage({ channel, pillar: chosenPillar, angle: chosenAngle, context });

  const response = await client.models.generateContent({
    model: MODEL_GENERATE,
    contents: userMessage,
    config: {
      systemInstruction: system,
      maxOutputTokens: 4000,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text || '';
  const parsed = parseJsonResponse(text);
  return { ...parsed, channel, pillar: chosenPillar, angle: chosenAngle };
}

function buildUserMessage({ channel, pillar, angle, context }) {
  const parts = [
    `Gere 3 variações de post pra ${channel} no pilar "${pillar}".`,
    angle ? `Ângulo sugerido: ${angle}.` : '',
    context ? `Contexto adicional: ${context}` : '',
    '',
    'Retorne JSON puro conforme o formato definido no system prompt.',
  ].filter(Boolean);
  return parts.join('\n');
}

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Falha ao parsear resposta do Gemini: ${e.message}\nRaw: ${text.slice(0, 500)}`);
  }
}

function mockGeneration({ channel, pillar, angle }) {
  const isCarousel = pillar === 'dica' && channel === 'instagram';
  return {
    channel,
    pillar,
    angle,
    variations: [
      {
        id: 1,
        hook: `[MOCK ${channel}/${pillar} #1] Você já mandou Rev04 quando devia ser Rev06?`,
        body: `[MOCK] Variação direta sobre dor ${angle || 'genérica'}.\n\nDetalhe concreto.\nImplicação.\n\nPergunta?`,
        format: isCarousel ? 'carousel' : 'single',
        slides: isCarousel ? ['Slide 1', 'Slide 2', 'Slide 3', 'Slide 4', 'Slide 5'] : undefined,
      },
      {
        id: 2,
        hook: `[MOCK ${channel}/${pillar} #2] Cena: 23h, escritório vazio, planilha aberta.`,
        body: `[MOCK] Variação narrativa.\n\nCena.\nVirada.\nFechamento.`,
        format: 'single',
      },
      {
        id: 3,
        hook: `[MOCK ${channel}/${pillar} #3] 5 sinais que você tá refém da planilha`,
        body: `[MOCK] Variação em lista.\n\n1. Item\n2. Item\n3. Item\n4. Item\n5. Item`,
        format: isCarousel ? 'carousel' : 'single',
        slides: isCarousel ? ['Hook', '1', '2', '3', '4', '5', 'CTA'] : undefined,
      },
    ],
    meta: {
      pillar,
      angle: angle || 'mock',
      reasoning: '[MOCK] Geração sem chamada API. Use GEMINI_API_KEY pra geração real.',
    },
  };
}

export const _internal = { parseJsonResponse, buildFewShot, mockGeneration, MODEL_GENERATE, MODEL_SIMPLE };
