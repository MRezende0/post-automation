// Endpoint do scheduler. Disparado pelo Vercel Cron (vercel.json, */10min).
// Protegido por CRON_SECRET: o Vercel manda `Authorization: Bearer <CRON_SECRET>`
// nos crons; aceito também ?key= e header x-cron-key pra teste manual.

import { NextResponse } from 'next/server';
import { runPublishDue } from '@/lib/publish';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem segredo configurado → não bloqueia (dev)
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('key');
  const fromHeader = req.headers.get('x-cron-key');
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  return secret === fromQuery || secret === fromHeader || secret === bearer;
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
