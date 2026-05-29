// rag.js — RAG leve sobre a base de conhecimento (docs + exemplos).
// Embeddings via Gemini (text-embedding-004), índice em arquivo JSON e busca por
// similaridade de cosseno em memória. Sem infra externa — adequado a um corpus
// pequeno (centenas de chunks). Pra milhares, migrar pra pgvector/Chroma.
//
// Construir o índice: node src/build-index.js  → content/kb-index.json
// Usar na geração: RAG_ENABLED=true (ver src/generate.js).

import { GoogleGenAI } from '@google/genai';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const EMBED_MODEL = 'text-embedding-004';
const INDEX_FILE = path.resolve(process.cwd(), 'content/kb-index.json');

// Quebra texto em chunks por parágrafo, agrupando até ~maxChars.
export function chunkText(text, { maxChars = 800 } = {}) {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > maxChars && buf) {
      chunks.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

export function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY ausente (necessária pra embeddings).');
  return new GoogleGenAI({ apiKey });
}

export async function embed(text) {
  const res = await client().models.embedContent({ model: EMBED_MODEL, contents: text });
  return res.embeddings?.[0]?.values || res.embedding?.values || [];
}

export async function loadIndex() {
  if (!existsSync(INDEX_FILE)) return null;
  return JSON.parse(await readFile(INDEX_FILE, 'utf8'));
}

// Recupera os top-K chunks mais relevantes pra query. Retorna [] se não há índice.
export async function retrieve(query, { topK = 5 } = {}) {
  const index = await loadIndex();
  if (!index?.chunks?.length) return [];
  const qv = await embed(query);
  return index.chunks
    .map(c => ({ ...c, score: cosineSim(qv, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export const _internal = { chunkText, cosineSim, EMBED_MODEL, INDEX_FILE };
