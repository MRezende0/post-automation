import { NextResponse } from 'next/server';
import { reschedulePost, cancelScheduled, retryScheduled } from '@/lib/scheduling';

// Ações sobre um agendado: reschedule | cancel | retry.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, action, scheduledFor } = body ?? {};
    if (!id || !action) return NextResponse.json({ error: 'id e action obrigatórios' }, { status: 400 });

    if (action === 'reschedule') {
      if (!scheduledFor) return NextResponse.json({ error: 'scheduledFor obrigatório' }, { status: 400 });
      await reschedulePost(String(id), new Date(String(scheduledFor)).toISOString());
    } else if (action === 'cancel') {
      await cancelScheduled(String(id));
    } else if (action === 'retry') {
      await retryScheduled(String(id));
    } else {
      return NextResponse.json({ error: 'action inválida' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
