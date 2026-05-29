// Monta a legenda final = corpo + hashtags estruturadas. Porta fiel de
// generate.js:composeCaption — usado como sugestão inicial editável na plataforma.

import type { Variation } from './types';

export function composeCaption(variation: Partial<Variation> | null | undefined): string {
  const body = (variation?.body || '').trim();
  const tags = Array.isArray(variation?.hashtags) ? variation!.hashtags! : [];
  const norm = tags
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));
  return norm.length ? `${body}\n\n${norm.join(' ')}` : body;
}
