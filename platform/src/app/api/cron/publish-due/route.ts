// Endpoint do scheduler, disparado pelo workflow publish-due (a cada 10min).
// Exige `Authorization: Bearer <CRON_SECRET>`. Sem CRON_SECRET configurado, recusa tudo:
// checagem de segredo falha fechada. Segredo na query string não é aceito (vaza em log).

import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/auth';
import { runPublishDue } from '@/lib/publish';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return safeEqual(auth.slice(7), secret);
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const summary = await runPublishDue();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
