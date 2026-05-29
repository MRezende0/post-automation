import { NextResponse } from 'next/server';
import { approvePending } from '@/lib/scheduling';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pendingId, captionId, artId, captionText, scheduledFor } = body ?? {};
    if (!pendingId || captionId == null || artId == null) {
      return NextResponse.json({ error: 'pendingId, captionId e artId são obrigatórios' }, { status: 400 });
    }
    const result = await approvePending({
      pendingId: String(pendingId),
      captionId: Number(captionId),
      artId: Number(artId),
      captionText: captionText ? String(captionText) : undefined,
      scheduledFor: scheduledFor ? String(scheduledFor) : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
