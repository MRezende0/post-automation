import { NextResponse } from 'next/server';
import { reschedulePost, cancelScheduled, retryScheduled } from '@/lib/scheduling';
import { requireTenant } from '@/lib/session';
import { parseScheduledAction } from '@/lib/route-input';
import { apiError, badRequest } from '@/lib/api';

// Ações sobre um agendado: reschedule | cancel | retry.
export async function POST(req: Request) {
  try {
    const t = await requireTenant();
    const parsed = parseScheduledAction(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const a = parsed.value;
    if (a.action === 'reschedule') await reschedulePost(t, a.id, a.scheduledFor);
    else if (a.action === 'cancel') await cancelScheduled(t, a.id);
    else await retryScheduled(t, a.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, 'api/scheduled');
  }
}
