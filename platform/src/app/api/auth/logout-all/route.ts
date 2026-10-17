import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookie } from '@/lib/auth';
import { bumpSessionVersion } from '@/lib/accounts';
import { requirePermission, requireSession } from '@/lib/session';
import { apiError } from '@/lib/api';

// Sair de todos os dispositivos: sobe a versão da sessão e limpa o cookie deste.
export async function POST() {
  try {
    await requirePermission('content.view');
    const { user } = await requireSession();
    if (user) await bumpSessionVersion(user);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, '', { ...sessionCookie, maxAge: 0 });
    return res;
  } catch (e) {
    return apiError(e, 'api/auth/logout-all');
  }
}
