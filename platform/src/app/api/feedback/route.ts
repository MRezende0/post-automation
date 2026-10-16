import { NextResponse } from 'next/server';
import { parseFeedbackInput } from '@/lib/learning';
import { saveFeedback, deleteFeedback } from '@/lib/feedback';
import { requireTenant } from '@/lib/session';
import { isUuid } from '@/lib/route-input';
import { apiError, badRequest } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const t = await requireTenant();
    const parsed = parseFeedbackInput(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const id = await saveFeedback(t, parsed.value);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return apiError(e, 'api/feedback');
  }
}

export async function DELETE(req: Request) {
  try {
    const t = await requireTenant();
    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) return badRequest('Feedback não encontrado. Recarregue a página.');
    await deleteFeedback(t, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, 'api/feedback');
  }
}
