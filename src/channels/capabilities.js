// capabilities.js: lado Node da matriz de capacidades por rede. Mesma fonte da plataforma
// (platform/src/lib/channel-capabilities.json). A geração só propõe formato que sai por API.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'platform/src/lib/channel-capabilities.json');

let matrix = null;

export function capabilities() {
  if (!matrix) matrix = JSON.parse(readFileSync(FILE, 'utf8')).channels;
  return matrix;
}

export function canAutoPublish(channel, format) {
  return capabilities()[channel]?.formats?.[format || 'single']?.publish === 'auto';
}

// Formatos do tenant que a rede publica sozinha; o resto não entra no bandit.
export function publishableFormats(channel, formats = []) {
  return formats.filter(f => canAutoPublish(channel, f));
}
