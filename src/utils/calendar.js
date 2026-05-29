// calendar.js — campanhas temáticas por período. Uma campanha ativa injeta
// tema/pilar/ângulo na geração e tem prioridade sobre feriado e rotação.
// Chamado por: src/index.js. Lê: content/campaigns.yaml.
//
// Séries ORDENADAS com datas: use a fila (content/queue.yaml) com `scheduled_for`.
// O calendário cobre o "tema vigente"; a fila cobre a sequência datada.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

function campaignsFile() {
  return path.resolve(process.cwd(), 'content/campaigns.yaml');
}

export async function getCampaigns() {
  const file = campaignsFile();
  if (!existsSync(file)) return [];
  const parsed = yaml.load(await readFile(file, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function atUtcMidnight(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function parseDay(s) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// Campanha ativa = a primeira cujo intervalo [start, end] contém `today` (inclusive).
// Sem start → vale desde sempre; sem end → vale pra sempre.
export function pickActiveCampaign(campaigns, today = new Date()) {
  const ref = atUtcMidnight(today);
  for (const c of campaigns) {
    const start = parseDay(c.start);
    const end = parseDay(c.end);
    if (start != null && ref < start) continue;
    if (end != null && ref > end) continue;
    return c;
  }
  return null;
}

export async function getActiveCampaign(today = new Date()) {
  return pickActiveCampaign(await getCampaigns(), today);
}

// Linha de contexto que vai pro prompt de geração.
export function campaignContext(campaign) {
  return `CAMPANHA — ${campaign.name}. ${campaign.context || ''}`.trim();
}

export const _internal = { pickActiveCampaign, parseDay };
