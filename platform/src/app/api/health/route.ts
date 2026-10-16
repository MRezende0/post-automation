// Health check público: diz se o app alcança o banco, sem expor detalhe do erro.
// 200 = tudo ok; 503 = alguma dependência fora. Monitor externo (UptimeRobot, Better Stack)
// aponta pra cá.

import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function checkDb(): Promise<boolean> {
  try {
    const { error } = await db().from('publishing_controls').select('tenant_id', { head: true, count: 'exact' }).limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function GET() {
  const dbOk = await checkDb();
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev';
  return NextResponse.json(
    { status: dbOk ? 'ok' : 'degraded', checks: { db: dbOk ? 'ok' : 'fail' }, version },
    { status: dbOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
