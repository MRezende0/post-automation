// queue.js — lê/escreve YAMLs de fila, publicados e rejeitados.
// Chamado por: src/index.js, src/utils/ranking.js, tests.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

function paths() {
  const contentDir = path.resolve(process.cwd(), 'content');
  return {
    QUEUE_FILE: path.join(contentDir, 'queue.yaml'),
    PUBLISHED_FILE: path.join(contentDir, 'published.yaml'),
    REJECTED_FILE: path.join(contentDir, 'rejected.yaml'),
    PENDING_FILE: path.join(contentDir, 'pending-approval.yaml'),
  };
}

const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function ensureDir(file) {
  const dir = path.dirname(file);
  if (!existsSync(dir)) {
    const fs = await import('node:fs/promises');
    await fs.mkdir(dir, { recursive: true });
  }
}

async function readYaml(file) {
  if (!existsSync(file)) return [];
  const raw = await readFile(file, 'utf8');
  const parsed = yaml.load(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeYaml(file, data) {
  await ensureDir(file);
  const out = yaml.dump(data, { lineWidth: 120, noRefs: true });
  await writeFile(file, out, 'utf8');
}

export async function getQueue() {
  return readYaml(paths().QUEUE_FILE);
}

export async function getPublished() {
  return readYaml(paths().PUBLISHED_FILE);
}

export async function getRejected() {
  return readYaml(paths().REJECTED_FILE);
}

// Item é elegível se não tem agendamento ou se a data já chegou.
function isDue(item, now) {
  if (!item || !item.scheduled_for) return true;
  const when = new Date(item.scheduled_for);
  if (Number.isNaN(when.getTime())) return true; // data inválida → não bloqueia
  return when.getTime() <= now;
}

export async function popNext(now = Date.now()) {
  const queue = await getQueue();
  if (queue.length === 0) return null;
  const idx = queue.findIndex(item => isDue(item, now));
  if (idx === -1) return null; // só restam itens agendados pro futuro
  const [next] = queue.splice(idx, 1);
  await writeYaml(paths().QUEUE_FILE, queue);
  return next;
}

export async function markPublished(item, result) {
  const published = await getPublished();
  published.push({
    ...item,
    published_at: new Date().toISOString(),
    chosen_variation: result.chosenVariationId,
    channels: result.channels,
  });
  await writeYaml(paths().PUBLISHED_FILE, published);
}

export async function markRejected(item, reason) {
  const rejected = await getRejected();
  rejected.push({
    ...item,
    rejected_at: new Date().toISOString(),
    reason: reason || 'sem motivo informado',
  });
  await writeYaml(paths().REJECTED_FILE, rejected);
}

export async function pushToQueue(item) {
  const queue = await getQueue();
  queue.push(item);
  await writeYaml(paths().QUEUE_FILE, queue);
}

// Regrava a lista inteira de publicados — usado pelo coletor de métricas
// pra anexar insights nos posts já existentes sem duplicar.
export async function writePublished(list) {
  await writeYaml(paths().PUBLISHED_FILE, list);
}

export async function getPending() {
  return readYaml(paths().PENDING_FILE);
}

export async function loadPending(channel) {
  const items = await getPending();
  const now = Date.now();
  const valid = [];
  let found = null;
  for (const item of items) {
    const age = now - new Date(item.saved_at).getTime();
    if (age > PENDING_TTL_MS) continue;
    if (!found && item.channel === channel) {
      found = item;
    } else {
      valid.push(item);
    }
  }
  if (found || valid.length !== items.length) {
    await writeYaml(paths().PENDING_FILE, valid);
  }
  return found;
}

export async function savePending(item) {
  const items = await getPending();
  const filtered = items.filter(i => i.channel !== item.channel);
  filtered.push({ ...item, saved_at: new Date().toISOString() });
  await writeYaml(paths().PENDING_FILE, filtered);
}

export async function clearPending(channel) {
  const items = await getPending();
  const filtered = items.filter(i => i.channel !== channel);
  if (filtered.length !== items.length) {
    await writeYaml(paths().PENDING_FILE, filtered);
  }
}

export async function expirePending() {
  const items = await getPending();
  const now = Date.now();
  const valid = items.filter(i => now - new Date(i.saved_at).getTime() <= PENDING_TTL_MS);
  const expired = items.filter(i => now - new Date(i.saved_at).getTime() > PENDING_TTL_MS);
  if (expired.length > 0) {
    await writeYaml(paths().PENDING_FILE, valid);
  }
  return expired;
}

export const _paths = paths;
export const _PENDING_TTL_MS = PENDING_TTL_MS;
