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
  };
}

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

export async function popNext() {
  const queue = await getQueue();
  if (queue.length === 0) return null;
  const [next, ...rest] = queue;
  await writeYaml(paths().QUEUE_FILE, rest);
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

export const _paths = paths;
