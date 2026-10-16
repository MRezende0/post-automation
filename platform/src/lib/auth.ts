// Gate de acesso single-user: senha única + cookie de sessão assinado (HMAC).
// Usa Web Crypto (disponível no edge middleware e nos route handlers) — sem
// node:crypto, pra rodar igual nos dois runtimes.

import { isTenantId } from './tenant';

export const SESSION_COOKIE = 'pa_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET ausente');
  return s;
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

// Tenant da instalação de senha única. Com o login por usuário, vem da membership.
export function installTenantId(): string {
  return process.env.TENANT_ID || 'pilar';
}

export type Session = { tenantId: string };

// token = <tenant>.<expiraEm>.<assinatura>. O tenant entra na assinatura: trocar o tenant no
// cookie invalida a sessão. Token antigo (sem tenant) não valida e leva de volta ao login.
export async function createSessionToken(tenantId: string): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = await hmac(`${tenantId}.${exp}`);
  return `${tenantId}.${exp}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [tenantId, exp, sig] = parts;
  if (!isTenantId(tenantId) || !exp || !sig) return null;
  if (!(Number(exp) > Date.now())) return null;
  if (!safeEqual(await hmac(`${tenantId}.${exp}`), sig)) return null;
  return { tenantId };
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.PLATFORM_PASSWORD;
  if (!expected) throw new Error('PLATFORM_PASSWORD ausente');
  return safeEqual(input, expected);
}

// Comparação em tempo constante (não para no primeiro byte diferente).
export function safeEqual(input: string, expected: string): boolean {
  const a = new TextEncoder().encode(input);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

// usado em fromB64url indiretamente; exportado caso precise validar payloads
export { fromB64url };
