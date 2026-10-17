import { NextResponse } from 'next/server';
import { parseTargetInput } from '@/lib/engage-model';
import { addTarget, removeTarget } from '@/lib/engage';
import { requirePermission } from '@/lib/session';
import { isUuid } from '@/lib/route-input';
import { apiError, badRequest } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const t = await requirePermission('content.edit');
    const parsed = parseTargetInput(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    await addTarget(t, parsed.value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, 'api/engage/targets');
  }
}

export async function DELETE(req: Request) {
  try {
    const t = await requirePermission('content.edit');
    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) return badRequest('Conta não encontrada. Recarregue a página.');
    await removeTarget(t, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, 'api/engage/targets');
  }
}
