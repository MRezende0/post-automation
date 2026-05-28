// linkedin.js — publica post (texto + imagem ou PDF carrossel) via LinkedIn API v2.
// Chamado por: src/index.js. Docs: learn.microsoft.com/linkedin/marketing/integrations/community-management/shares/posts-api
//
// Fluxo /rest/posts (versão 202405+):
//   1. POST /rest/images?action=initializeUpload (registra slot)
//   2. PUT upload binário no URL retornado
//   3. POST /rest/posts com content.media referenciando image URN

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const API_BASE = 'https://api.linkedin.com/rest';
const VERSION = '202405';

function token() {
  const t = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!t) throw new Error('LINKEDIN_ACCESS_TOKEN ausente');
  return t;
}

function authorUrn() {
  const urn = process.env.LINKEDIN_AUTHOR_URN;
  if (!urn) throw new Error('LINKEDIN_AUTHOR_URN ausente (formato: urn:li:person:XXX)');
  return urn;
}

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${token()}`,
    'LinkedIn-Version': VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  };
}

async function apiJson(method, endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: headers({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn API ${res.status}: ${text}`);
  }
  if (res.status === 201 || res.status === 204) {
    return { id: res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') };
  }
  return res.json();
}

async function uploadImage(localPath) {
  if (!existsSync(localPath)) throw new Error(`Arquivo não existe: ${localPath}`);

  const init = await apiJson('POST', '/images?action=initializeUpload', {
    initializeUploadRequest: { owner: authorUrn() },
  });

  const uploadUrl = init.value?.uploadUrl;
  const imageUrn = init.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error('Resposta inesperada de initializeUpload');

  const buffer = await readFile(localPath);
  const upRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: buffer,
  });
  if (!upRes.ok) {
    throw new Error(`Falha upload imagem LinkedIn: ${upRes.status} ${await upRes.text()}`);
  }

  return imageUrn;
}

export async function publishText({ text, imagePath, dryRun = false }) {
  if (dryRun) {
    return { id: 'mock_li_post_id', dryRun: true, channel: 'linkedin', textLength: text?.length || 0, hasImage: !!imagePath };
  }

  let mediaUrn = null;
  if (imagePath) {
    mediaUrn = await uploadImage(imagePath);
  }

  const body = {
    author: authorUrn(),
    commentary: text,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  if (mediaUrn) {
    body.content = { media: { id: mediaUrn } };
  }

  return apiJson('POST', '/posts', body);
}

export async function publishCarousel({ text, imagePaths, dryRun = false }) {
  if (dryRun) {
    return { id: 'mock_li_carousel_id', dryRun: true, channel: 'linkedin', slides: imagePaths?.length || 0 };
  }
  // LinkedIn Posts API aceita até 1 imagem inline; pra carrossel usa-se PDF como document.
  // Implementação real exige montar PDF dos slides PNG (TODO).
  throw new Error('LinkedIn carousel requer PDF — TODO: gerar PDF dos slides e usar /documents endpoint');
}

// Coleta likes/comentários de um post via socialActions. Impressões exigem
// o endpoint de organizationalEntityShareStatistics (só páginas de empresa) —
// deixado como null quando indisponível. Best-effort, não quebra a coleta.
export async function getInsights(shareUrn) {
  if (!shareUrn) return null;
  const out = { likes: null, comments: null, impressions: null };

  try {
    const encoded = encodeURIComponent(shareUrn);
    const res = await fetch(`${API_BASE}/socialActions/${encoded}`, { headers: headers() });
    if (res.ok) {
      const json = await res.json();
      out.likes = json.likesSummary?.totalLikes ?? null;
      out.comments = json.commentsSummary?.totalComments ?? json.commentsSummary?.aggregatedTotalComments ?? null;
    }
  } catch (_) { /* mantém null */ }

  return out;
}

export async function refreshToken() {
  const refresh = process.env.LINKEDIN_REFRESH_TOKEN;
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!refresh || !clientId || !clientSecret) {
    throw new Error('LINKEDIN_REFRESH_TOKEN, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET necessários');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`LinkedIn refresh ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function checkTokenHealth() {
  const res = await fetch(`${API_BASE}/me`, { headers: headers() });
  if (!res.ok) {
    return { valid: false, error: `${res.status} ${await res.text()}` };
  }
  // LinkedIn não expõe expires_at via API; precisa rastrear localmente.
  // Por ora: se /me responde 200, token válido.
  return { valid: true, daysLeft: null, note: 'LinkedIn não expõe expiry via API; rastreie data de geração' };
}
