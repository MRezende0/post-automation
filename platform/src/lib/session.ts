// session.ts: quem está logado e em qual tenant. Server-only (lê o cookie).
// Hoje a sessão vem da senha única (auth.ts); com o login por usuário (SPEC 006 F2) só a
// origem muda: o resto do app já recebe o tenant por aqui.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from './auth';
import { tenantDb, type TenantDb } from './tenant-db';

export class UnauthorizedError extends Error {
  constructor() {
    super('Sua sessão expirou. Entre de novo.');
  }
}

export async function currentTenantId(): Promise<string> {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) throw new UnauthorizedError();
  return session.tenantId;
}

export async function requireTenant(): Promise<TenantDb> {
  return tenantDb(await currentTenantId());
}

// Páginas: sessão vencida leva ao login em vez de quebrar a tela.
export async function pageTenant(): Promise<TenantDb> {
  try {
    return await requireTenant();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect('/login');
    throw e;
  }
}
