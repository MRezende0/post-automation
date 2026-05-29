// build-index.js — constrói o índice de embeddings da base de conhecimento.
// Varre docs/ + content/examples/ → chunks → embeddings (Gemini) → content/kb-index.json.
//
// Uso: node src/build-index.js
// Requer GEMINI_API_KEY. Rode de novo quando os docs mudarem.

import 'dotenv/config';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chunkText, embed, _internal } from './utils/rag.js';

const ROOT = process.cwd();
const SOURCES = ['docs', 'content/examples'];

async function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...await walk(full));
    else if (/\.(md|txt)$/i.test(entry)) out.push(full);
  }
  return out;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY ausente.');

  const files = [];
  for (const src of SOURCES) files.push(...await walk(path.join(ROOT, src)));

  const chunks = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const text = await readFile(file, 'utf8');
    const pieces = chunkText(text);
    for (let i = 0; i < pieces.length; i += 1) {
      const vector = await embed(pieces[i]);
      chunks.push({ id: `${rel}#${i}`, source: rel, text: pieces[i], vector });
      process.stdout.write('.');
    }
  }

  const index = { model: _internal.EMBED_MODEL, built_at: new Date().toISOString(), count: chunks.length, chunks };
  await writeFile(_internal.INDEX_FILE, JSON.stringify(index), 'utf8');
  console.log(`\n[build-index] ${chunks.length} chunks de ${files.length} arquivos → ${path.relative(ROOT, _internal.INDEX_FILE)}`);
}

main().catch(err => {
  console.error('[build-index] ERRO:', err.message);
  process.exit(1);
});
