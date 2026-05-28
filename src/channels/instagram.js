// instagram.js — publica post (single image ou carousel) via Instagram Graph API.
// Chamado por: src/index.js. Docs: developers.facebook.com/docs/instagram-api/guides/content-publishing
//
// Fluxo Graph API:
//   1. POST /{ig-user-id}/media → cria container (image_url ou children pra carousel)
//   2. POST /{ig-user-id}/media_publish → publica container
//
// Limitação: image_url precisa ser URL PÚBLICA. Em produção, fazer upload pra
// CDN/S3/imgur antes. Por enquanto suportamos modo dry-run + assumimos URL pública.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const GRAPH_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function token() {
  const t = process.env.IG_ACCESS_TOKEN;
  if (!t) throw new Error('IG_ACCESS_TOKEN ausente');
  return t;
}

function accountId() {
  const id = process.env.IG_BUSINESS_ACCOUNT_ID;
  if (!id) throw new Error('IG_BUSINESS_ACCOUNT_ID ausente');
  return id;
}

async function apiPost(endpoint, params) {
  const url = new URL(`${API_BASE}${endpoint}`);
  const form = new URLSearchParams({ ...params, access_token: token() });
  const res = await fetch(url, {
    method: 'POST',
    body: form,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IG API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function publishSingle({ imageUrl, caption, dryRun = false }) {
  if (dryRun) {
    return { id: 'mock_ig_post_id', dryRun: true, channel: 'instagram', imageUrl, captionLength: caption?.length || 0 };
  }
  if (!imageUrl) throw new Error('imageUrl obrigatório (precisa ser URL pública)');

  const container = await apiPost(`/${accountId()}/media`, {
    image_url: imageUrl,
    caption: caption || '',
  });

  const published = await apiPost(`/${accountId()}/media_publish`, {
    creation_id: container.id,
  });

  return { id: published.id, channel: 'instagram' };
}

export async function publishCarousel({ imageUrls, caption, dryRun = false }) {
  if (dryRun) {
    return { id: 'mock_ig_carousel_id', dryRun: true, channel: 'instagram', slides: imageUrls.length };
  }
  if (!imageUrls || imageUrls.length < 2) throw new Error('Carousel precisa 2+ imagens');
  if (imageUrls.length > 10) throw new Error('Carousel suporta no máximo 10 slides');

  const childIds = [];
  for (const url of imageUrls) {
    const child = await apiPost(`/${accountId()}/media`, {
      image_url: url,
      is_carousel_item: 'true',
    });
    childIds.push(child.id);
  }

  const container = await apiPost(`/${accountId()}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption: caption || '',
  });

  const published = await apiPost(`/${accountId()}/media_publish`, {
    creation_id: container.id,
  });

  return { id: published.id, channel: 'instagram', slides: imageUrls.length };
}

export async function refreshToken() {
  const current = token();
  const url = new URL(`${API_BASE}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', current);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IG refresh ${res.status}: ${text}`);
  }
  return res.json();
}

export async function checkTokenHealth() {
  const url = new URL(`${API_BASE}/debug_token`);
  url.searchParams.set('input_token', token());
  url.searchParams.set('access_token', token());
  const res = await fetch(url);
  if (!res.ok) {
    return { valid: false, error: await res.text() };
  }
  const json = await res.json();
  const expiresAt = json.data?.expires_at;
  const daysLeft = expiresAt ? Math.round((expiresAt * 1000 - Date.now()) / 86400000) : null;
  return { valid: json.data?.is_valid, daysLeft, raw: json.data };
}

// TODO: upload de imagem local pra storage temporário público (S3, imgur, etc).
// Por enquanto consumidor precisa subir e passar URL pública.
export async function uploadImage(localPath) {
  if (!existsSync(localPath)) throw new Error(`Arquivo não existe: ${localPath}`);
  await readFile(localPath);
  throw new Error('uploadImage não implementado. Configure storage público (S3, R2, GitHub Pages) e passe URL.');
}
