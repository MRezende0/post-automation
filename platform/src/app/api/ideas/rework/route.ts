import { NextResponse } from 'next/server';
import { parseRework } from '@/lib/ideas-model';
import { requestRework } from '@/lib/ideas';
import { requirePermission } from '@/lib/session';
import { apiError, badRequest } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const t = await requirePermission('content.edit');
    const parsed = parseRework(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    await requestRework(t, parsed.value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, 'api/ideas/rework');
  }
}
