import { NextResponse } from 'next/server';
import { rejectPending } from '@/lib/scheduling';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pendingId, reason } = body ?? {};
    if (!pendingId) return NextResponse.json({ error: 'pendingId obrigatório' }, { status: 400 });
    await rejectPending(String(pendingId), reason ? String(reason) : undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
