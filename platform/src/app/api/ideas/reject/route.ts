import { NextResponse } from 'next/server';
import { rejectIdea } from '@/lib/ideas';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const briefId = typeof body?.briefId === 'string' ? body.briefId : '';
    if (!briefId) return NextResponse.json({ error: 'Ideia não encontrada.' }, { status: 400 });
    const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 1000) : undefined;
    await rejectIdea(briefId, reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 400 });
  }
}
