// generate.js — gera 3 variações de post via Gemini API com few-shot.
// Chamado por: src/index.js. Lê: docs/, prompts/, content/examples/.

import { GoogleGenAI } from '@google/genai';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chooseNextPillar, chooseNextAngle } from './utils/ranking.js';
import { getPublished } from './utils/queue.js';
import { retrieve } from './utils/rag.js';

const MODEL_GENERATE = 'gemini-2.5-flash';
const MODEL_SIMPLE = 'gemini-2.5-flash-lite';

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

// Lê a linha "Engajamento: 312 likes, 47 salvamentos, ..." e soma os números
// como score bruto. Sem a linha, retorna 0 (seeds entram, mas atrás dos reais).
function parseEngagementScore(content) {
  const match = content.match(/engajamento\s*:?(.*)/i);
  if (!match) return 0;
  const nums = match[1].match(/\d+/g);
  if (!nums) return 0;
  return nums.reduce((sum, n) => sum + Number(n), 0);
}

async function loadExamplesFrom(rel) {
  const dir = path.join(ROOT, rel);
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  const examples = [];
  for (const f of files) {
    if ((f.endsWith('.md') || f.endsWith('.txt')) && f.toLowerCase() !== 'readme.md') {
      const content = await readFile(path.join(dir, f), 'utf8');
      examples.push({ name: f, content, score: parseEngagementScore(content) });
    }
  }
  return examples;
}

async function loadExamples() {
  const [high, low] = await Promise.all([
    loadExamplesFrom('content/examples/high-performers'),
    loadExamplesFrom('content/examples/low-performers'),
  ]);
  // Maior engajamento primeiro; seeds (score 0) ficam no fim.
  high.sort((a, b) => b.score - a.score);
  return { high, low };
}

function buildFewShot({ high = [], low = [] }) {
  const sections = [];
  if (high.length > 0) {
    const blocks = high
      .slice(0, 6)
      .map((ex, i) => `### Exemplo ${i + 1} (${ex.name})\n${ex.content}`)
      .join('\n\n');
    sections.push(
      `## Exemplos de posts que performaram bem (referência de tom e estrutura — imite o tom, não copie o conteúdo)\n\n${blocks}`,
    );
  }
  if (low.length > 0) {
    const blocks = low
      .slice(0, 4)
      .map((ex, i) => `### Anti-exemplo ${i + 1} (${ex.name})\n${ex.content}`)
      .join('\n\n');
    sections.push(
      `## Anti-exemplos — posts que performaram MAL (NÃO repita esse tom, estrutura ou tipo de hook)\n\n${blocks}`,
    );
  }
  return sections.length > 0 ? `\n\n${sections.join('\n\n')}` : '';
}

// RAG opt-in (RAG_ENABLED=true): recupera trechos relevantes da base indexada.
// Best-effort — sem índice/sem chave/erro → string vazia (não quebra a geração).
async function retrieveKnowledge({ pillar, angle, context }) {
  if (process.env.RAG_ENABLED !== 'true') return '';
  try {
    const query = [pillar, angle, context].filter(Boolean).join(' ');
    const hits = await retrieve(query, { topK: 5 });
    if (!hits.length) return '';
    const blocks = hits.map(h => `- (${h.source}) ${h.text}`).join('\n\n');
    return `## Conhecimento recuperado (use o relevante; não invente)\n\n${blocks}`;
  } catch (e) {
    return '';
  }
}

export async function generatePost({ channel, pillar, angle, context, dryRun = false }) {
  if (!['instagram', 'linkedin'].includes(channel)) {
    throw new Error(`Canal inválido: ${channel}`);
  }

  const published = await getPublished();

  let chosenPillar = pillar;
  let chosenAngle = angle;
  if (!chosenPillar) {
    chosenPillar = chooseNextPillar(published);
    chosenAngle = chooseNextAngle(chosenPillar, published);
  }

  if (dryRun) {
    return mockGeneration({ channel, pillar: chosenPillar, angle: chosenAngle });
  }

  const recentHooks = extractRecentHooks(published);

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

  const ragBlock = await retrieveKnowledge({ pillar: chosenPillar, angle: chosenAngle, context });

  const system = [
    systemBase,
    `## Canal alvo: ${channel}`,
    channelPrompt,
    `## Pilar alvo: ${chosenPillar}`,
    pillarPrompt,
    ragBlock,
    buildFewShot(examples),
  ].filter(Boolean).join('\n\n---\n\n');

  const userMessage = buildUserMessage({ channel, pillar: chosenPillar, angle: chosenAngle, context, recentHooks });

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

// Últimos ganchos publicados, pra instruir o modelo a não repetir tema/abertura.
function extractRecentHooks(published, limit = 12) {
  return published
    .slice(-limit)
    .map(item => item.post?.hook)
    .filter(Boolean);
}

function buildUserMessage({ channel, pillar, angle, context, recentHooks = [] }) {
  const avoidBlock = recentHooks.length
    ? `Ganchos já usados recentemente (NÃO repita o tema nem a abertura destes):\n${recentHooks.map(h => `- ${h}`).join('\n')}`
    : '';
  const parts = [
    `Gere 3 variações de post pra ${channel} no pilar "${pillar}".`,
    angle ? `Ângulo sugerido: ${angle}.` : '',
    context ? `Contexto adicional: ${context}` : '',
    avoidBlock,
    '',
    'Retorne JSON puro conforme o formato definido no system prompt.',
  ].filter(Boolean);
  return parts.join('\n');
}

// LLM-as-judge: escolhe a melhor variação usando o modelo simples (barato).
// Retorna { chosenId, reason } ou null se a API não estiver disponível/falhar.
export async function judgeVariations({ channel, pillar, variations }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !variations?.length) return null;

  const client = new GoogleGenAI({ apiKey });
  const list = variations
    .map(v => `Variação ${v.id}:\nHook: ${v.hook}\nCorpo: ${v.body}`)
    .join('\n\n');

  const prompt = [
    `Você é editor de conteúdo de um SaaS B2B pra escritórios de engenharia.`,
    `Escolha a MELHOR das ${variations.length} variações pra ${channel}, pilar "${pillar}".`,
    `Critérios: hook que para o scroll, dor concreta (não abstrata), zero buzzword, frases curtas, autenticidade.`,
    '',
    list,
    '',
    'Responda só JSON: {"chosenId": <número>, "reason": "<1 frase>"}',
  ].join('\n');

  try {
    const response = await client.models.generateContent({
      model: MODEL_SIMPLE,
      contents: prompt,
      config: { maxOutputTokens: 200, responseMimeType: 'application/json' },
    });
    const parsed = parseJsonResponse(response.text || '');
    if (!variations.some(v => v.id === parsed.chosenId)) return null;
    return { chosenId: parsed.chosenId, reason: parsed.reason || '' };
  } catch (e) {
    return null;
  }
}

// Guardrails programáticos — flags que NÃO deviam passar (ICP de engenharia de projeto).
const GUARD_BUZZWORDS = ['sinergia', 'otimizar', 'escalável', 'ecossistema', 'disruptivo', 'solução integrada', 'gestão eficiente'];
const GUARD_FORA_ICP = ['canteiro', 'diário de obra', 'diario de obra'];
const GUARD_FORA_RECORTE = ['arquitet']; // conteúdo é só engenharia por ora

export function checkGuardrails(variation, { pillar } = {}) {
  const text = `${variation?.hook || ''}\n${variation?.body || ''}`.toLowerCase();
  const flags = [];
  for (const w of GUARD_BUZZWORDS) if (text.includes(w)) flags.push(`buzzword:${w}`);
  for (const w of GUARD_FORA_ICP) if (text.includes(w)) flags.push(`fora-icp:${w}`);
  for (const w of GUARD_FORA_RECORTE) if (text.includes(w)) flags.push(`fora-recorte:${w}`);
  if (pillar === 'prova' && /\d/.test(text)) flags.push('prova-com-numero:verificar-fonte');
  return { clean: flags.length === 0, flags };
}

// Etapa de auto-edição: um "editor" reescreve o post aplicando o checklist de voz.
// Best-effort — devolve a variação original se a API falhar. Não inventa fatos.
export async function polishPost({ channel, pillar, variation }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !variation) return variation;
  const client = new GoogleGenAI({ apiKey });

  const prompt = [
    'Você é editor de copy do Pilar (SaaS pra escritório de engenharia de projeto — não obra).',
    'Revise o post abaixo aplicando o checklist de voz, SEM inventar fato novo:',
    '- Hook curto que para o scroll.',
    '- Dor concreta e específica; zero buzzword (sinergia, otimizar, performance, ecossistema, escalável).',
    '- Frases curtas — nenhuma com mais de 25 palavras.',
    '- NÃO falar de obra/canteiro. NÃO citar arquitetura. NÃO inventar número.',
    '- Tom seco e direto, estilo: "Proposta no feeling. Financeiro descolado da operação."',
    '',
    `Canal: ${channel} | Pilar: ${pillar}`,
    `Hook: ${variation.hook}`,
    `Corpo: ${variation.body}`,
    '',
    'Devolva só JSON: {"hook":"...","body":"..."} — mesmo idioma e formato, só melhor.',
  ].join('\n');

  try {
    const response = await client.models.generateContent({
      model: MODEL_SIMPLE,
      contents: prompt,
      config: { maxOutputTokens: 1500, responseMimeType: 'application/json' },
    });
    const parsed = parseJsonResponse(response.text || '');
    if (parsed.hook && parsed.body) return { ...variation, hook: parsed.hook, body: parsed.body };
    return variation;
  } catch (e) {
    return variation;
  }
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
