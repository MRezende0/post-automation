import { NextResponse } from 'next/server';
import { checkPassword, createSessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: Request) {
  let password = '';
  try {
    const body = await req.json();
    password = String(body?.password ?? '');
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  if (!(await checkPassword(password))) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
