// Publicação no X (SPEC 002). OAuth 1.0a user context: o token não expira, então o
// scheduler não precisa girar refresh token. Mídia sobe pela API v2 (/2/media/upload),
// o post sai em /2/tweets. Pay-per-use: US$ 0,015 por post, US$ 0,20 com link.
// Docs: docs.x.com/x-api/posts/manage-tweets, docs.x.com/x-api/media

import { createHmac, randomBytes } from 'node:crypto';
import { splitThread, TWEET_LIMIT } from '../thread';

export { splitThread };

const API_BASE = 'https://api.x.com/2';
const CHUNK_BYTES = 4 * 1024 * 1024; // append aceita até 5 MB por bloco
const VIDEO_WAIT_MS = 90_000;

export type Credentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

export type ThreadResult = {
  id: string;
  ids: string[];
  url: string;
  channel: 'twitter';
  media_id?: string | null;
  // thread parcial: o 1º tweet saiu, um seguinte falhou (não pode virar retry)
  partial_error?: string;
};

function credentials(): Credentials {
  const env = {
    X_API_KEY: process.env.X_API_KEY,
    X_API_SECRET: process.env.X_API_SECRET,
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN,
    X_ACCESS_TOKEN_SECRET: process.env.X_ACCESS_TOKEN_SECRET,
  };
  const missing = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Credencial do X ausente: configure ${missing.join(', ')}`);
  return {
    apiKey: env.X_API_KEY!,
    apiSecret: env.X_API_SECRET!,
    accessToken: env.X_ACCESS_TOKEN!,
    accessTokenSecret: env.X_ACCESS_TOKEN_SECRET!,
  };
}

// RFC 3986: encodeURIComponent deixa !'()* sem escapar, o OAuth exige escapar.
export function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

// Header Authorization OAuth 1.0a (HMAC-SHA1). Corpo JSON e multipart não entram na
// assinatura; só query string e, se houver, params de form urlencoded (`extraParams`).
export function oauthHeader(input: {
  method: string;
  url: string;
  creds: Credentials;
  extraParams?: Record<string, string>;
  nonce?: string;
  timestamp?: string;
}): string {
  const { method, creds } = input;
  const url = new URL(input.url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: input.nonce || randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: input.timestamp || String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  const pairs: [string, string][] = [
    ...Object.entries(oauth),
    ...Object.entries(input.extraParams || {}),
    ...Array.from(url.searchParams.entries()),
  ].map(([k, v]) => [percentEncode(k), percentEncode(v)]);
  pairs.sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : 1) : ak < bk ? -1 : 1));
  const paramString = pairs.map(([k, v]) => `${k}=${v}`).join('&');

  const baseUrl = `${url.origin}${url.pathname}`;
  const base = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(paramString)].join('&');
  const key = `${percentEncode(creds.apiSecret)}&${percentEncode(creds.accessTokenSecret)}`;
  const signature = createHmac('sha1', key).update(base).digest('base64');

  const header = { ...oauth, oauth_signature: signature };
  return `OAuth ${Object.entries(header)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ')}`;
}

async function api(method: string, path: string, body?: { json?: unknown; form?: FormData }): Promise<any> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { Authorization: oauthHeader({ method, url, creds: credentials() }) };
  let payload: BodyInit | undefined;
  if (body?.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body.json);
  } else if (body?.form) {
    payload = body.form; // o fetch define o boundary do multipart
  }
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  if (!res.ok) throw new Error(`X API ${res.status} em ${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function download(url: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar mídia ${url}: ${res.status}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') || '' };
}

export async function uploadImageFromUrl(imageUrl: string): Promise<string> {
  const { bytes, type } = await download(imageUrl);
  const form = new FormData();
  form.append('media', new Blob([bytes], { type: type || 'image/png' }));
  form.append('media_category', 'tweet_image');
  const r = await api('POST', '/media/upload', { form });
  const id = r?.data?.id;
  if (!id) throw new Error('Upload de imagem no X sem media id');
  return String(id);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Vídeo: initialize → append em blocos → finalize → espera o processamento.
export async function uploadVideoFromUrl(videoUrl: string, opts: { waitMs?: number } = {}): Promise<string> {
  const { bytes, type } = await download(videoUrl);
  const init = await api('POST', '/media/upload/initialize', {
    json: { media_type: type || 'video/mp4', total_bytes: bytes.length, media_category: 'tweet_video' },
  });
  const id = init?.data?.id;
  if (!id) throw new Error('Upload de vídeo no X sem media id');

  for (let i = 0, segment = 0; i < bytes.length; i += CHUNK_BYTES, segment += 1) {
    const form = new FormData();
    form.append('media', new Blob([bytes.subarray(i, i + CHUNK_BYTES)]));
    form.append('segment_index', String(segment));
    await api('POST', `/media/upload/${id}/append`, { form });
  }

  let info = (await api('POST', `/media/upload/${id}/finalize`))?.data?.processing_info;
  const deadline = Date.now() + (opts.waitMs ?? VIDEO_WAIT_MS);
  while (info && info.state !== 'succeeded') {
    if (info.state === 'failed') throw new Error(`X recusou o vídeo: ${JSON.stringify(info.error || info)}`);
    if (Date.now() > deadline) throw new Error('Vídeo ainda processando no X depois do tempo limite');
    await sleep(Math.max(0, Number(info.check_after_secs ?? 1)) * 1000);
    info = (await api('GET', `/media/upload?command=STATUS&media_id=${id}`))?.data?.processing_info;
  }
  return String(id);
}

export async function createPost(input: { text: string; mediaIds?: string[]; replyTo?: string }): Promise<string> {
  const body: Record<string, unknown> = { text: input.text };
  if (input.mediaIds?.length) body.media = { media_ids: input.mediaIds };
  if (input.replyTo) body.reply = { in_reply_to_tweet_id: input.replyTo };
  const r = await api('POST', '/tweets', { json: body });
  const id = r?.data?.id;
  if (!id) throw new Error('X não devolveu o id do post');
  return String(id);
}

// Mídia vai só no 1º tweet; cada tweet seguinte responde ao anterior. Falha no 1º
// lança (nada saiu, retry é seguro); falha depois vira `partial_error`.
export async function publishThread(input: {
  tweets: string[];
  imageUrl?: string | null;
  videoUrl?: string | null;
}): Promise<ThreadResult> {
  const tweets = input.tweets.filter((t) => t.trim());
  if (!tweets.length) throw new Error('Post do X sem texto');
  const tooLong = tweets.find((t) => t.length > TWEET_LIMIT);
  if (tooLong) throw new Error(`Tweet com ${tooLong.length} caracteres (limite ${TWEET_LIMIT}): "${tooLong.slice(0, 40)}..."`);

  let mediaId: string | null = null;
  if (input.videoUrl) mediaId = await uploadVideoFromUrl(input.videoUrl);
  else if (input.imageUrl) mediaId = await uploadImageFromUrl(input.imageUrl);

  const first = await createPost({ text: tweets[0], mediaIds: mediaId ? [mediaId] : undefined });
  const ids = [first];
  const result: ThreadResult = { id: first, ids, url: `https://x.com/i/status/${first}`, channel: 'twitter', media_id: mediaId };
  for (const text of tweets.slice(1)) {
    try {
      ids.push(await createPost({ text, replyTo: ids[ids.length - 1] }));
    } catch (e) {
      result.partial_error = e instanceof Error ? e.message : String(e);
      break;
    }
  }
  return result;
}

export async function replyWithLink(tweetId: string, text: string): Promise<{ id: string }> {
  return { id: await createPost({ text, replyTo: tweetId }) };
}

export const _internal = { TWEET_LIMIT, CHUNK_BYTES };
