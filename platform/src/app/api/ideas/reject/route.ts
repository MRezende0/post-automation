import { NextResponse } from 'next/server';
import { rejectIdea } from '@/lib/ideas';
import { requireTenant } from '@/lib/session';
import { apiError, badRequest } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const t = await requireTenant();
    const body = await req.json().catch(() => null);
    const briefId = typeof body?.briefId === 'string' ? body.briefId : '';
    if (!briefId) return badRequest('Ideia não encontrada.');
    const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 1000) : undefined;
    await rejectIdea(t, briefId, reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, 'api/ideas/reject');
  }
}
