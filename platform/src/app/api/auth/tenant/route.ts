import { NextResponse } from 'next/server';
import { SESSION_COOKIE, USER_SESSION_TTL_S, createUserSessionToken, sessionCookie } from '@/lib/auth';
import { markLogin, roleIn } from '@/lib/accounts';
import { requirePermission, requireSession, ForbiddenError } from '@/lib/session';
import { parseTenantSwitch } from '@/lib/route-input';
import { apiError, badRequest } from '@/lib/api';

// Troca a conta ativa. Só para quem é membro da conta pedida; a sessão nova sai assinada.
export async function POST(req: Request) {
  try {
    await requirePermission('content.view');
    const { user } = await requireSession();
    if (!user) throw new ForbiddenError();
    const parsed = parseTenantSwitch(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const role = await roleIn(user.id, parsed.value.tenantId);
    if (!role) return NextResponse.json({ error: 'Você não faz parte dessa conta. Escolha outra ou peça um convite.' }, { status: 403 });

    const token = await createUserSessionToken({ userId: user.id, tenantId: parsed.value.tenantId, sessionVersion: user.sessionVersion });
    await markLogin(user.id, parsed.value.tenantId);
    const res = NextResponse.json({ ok: true, tenantId: parsed.value.tenantId, role });
    res.cookies.set(SESSION_COOKIE, token, { ...sessionCookie, maxAge: USER_SESSION_TTL_S });
    return res;
  } catch (e) {
    return apiError(e, 'api/auth/tenant');
  }
}
