// Publicação LinkedIn — porta de src/channels/linkedin.js. Diferença: a arte é
// URL pública (Supabase Storage), então baixamos o binário e subimos via
// initializeUpload (a API exige PUT binário, não aceita URL remota).
// Docs: learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api

const API_BASE = 'https://api.linkedin.com/rest';
const VERSION = '202405';

function token(): string {
  const t = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!t) throw new Error('LINKEDIN_ACCESS_TOKEN ausente');
  return t;
}

function authorUrn(): string {
  const urn = process.env.LINKEDIN_AUTHOR_URN;
  if (!urn) throw new Error('LINKEDIN_AUTHOR_URN ausente (formato: urn:li:person:XXX)');
  return urn;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${token()}`,
    'LinkedIn-Version': VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  };
}

async function apiJson(method: string, endpoint: string, body?: unknown): Promise<any> {
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

async function uploadImageFromUrl(imageUrl: string): Promise<string> {
  const init = await apiJson('POST', '/images?action=initializeUpload', {
    initializeUploadRequest: { owner: authorUrn() },
  });
  const uploadUrl = init.value?.uploadUrl;
  const imageUrn = init.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error('Resposta inesperada de initializeUpload');

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Falha ao baixar arte ${imageUrl}: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const upRes = await fetch(uploadUrl, { method: 'PUT', body: buffer });
  if (!upRes.ok) throw new Error(`Falha upload imagem LinkedIn: ${upRes.status} ${await upRes.text()}`);
  return imageUrn;
}

export async function publishText(text: string, imageUrl?: string | null): Promise<{ id: string; channel: 'linkedin' }> {
  let mediaUrn: string | null = null;
  if (imageUrl) mediaUrn = await uploadImageFromUrl(imageUrl);

  const body: Record<string, unknown> = {
    author: authorUrn(),
    commentary: text,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (mediaUrn) body.content = { media: { id: mediaUrn } };

  const r = await apiJson('POST', '/posts', body);
  return { id: r.id, channel: 'linkedin' };
}
