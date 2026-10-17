import { NextResponse } from 'next/server';
import { authProvider, checkPassword, createSessionToken, installTenantId, SESSION_COOKIE } from '@/lib/auth';
import { parseLogin } from '@/lib/route-input';
import { apiError, badRequest } from '@/lib/api';

export async function POST(req: Request) {
  try {
    // Com o login por pessoa ligado, a senha única deixa de existir (SPEC 009).
    if (authProvider() !== 'password') return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    const parsed = parseLogin(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    if (!(await checkPassword(parsed.value.password))) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    const token = await createSessionToken(installTenantId());
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch (e) {
    return apiError(e, 'api/login');
  }
}
