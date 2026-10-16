// croquis.js: biblioteca fixa de croquis técnicos (assets/croquis) da foto-pergunta.
// O modelo escolhe um id da lista; o SVG sai sempre do repo, nunca do texto do modelo
// (o template injeta o SVG sem escape). Id inválido cai num croqui pelas tags.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'assets/croquis');

let manifest = null;

export function croquisManifest() {
  if (!manifest) manifest = JSON.parse(readFileSync(path.join(DIR, 'index.json'), 'utf8'));
  return manifest;
}

// Linha curta pro prompt: "id (rótulo)".
export function croquisPromptList() {
  return croquisManifest().map(c => `${c.id} (${c.label})`).join(', ');
}

// Id escolhido pelo modelo, se existir; senão o primeiro que casa com ângulo, depois
// com pilar; senão a prancha. Pura sobre o manifesto.
export function pickSketch({ id, pillar, angle } = {}, list = croquisManifest()) {
  const byId = list.find(c => c.id === id);
  if (byId) return byId;
  const tags = [angle, pillar].filter(Boolean);
  for (const tag of tags) {
    const hit = list.find(c => c.tags.includes(tag));
    if (hit) return hit;
  }
  return list.find(c => c.id === 'prancha') || list[0];
}

export function sketchSvg(entry) {
  return readFileSync(path.join(DIR, `${entry.id}.svg`), 'utf8');
}
