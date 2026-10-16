import { NextResponse } from 'next/server';
import { parseDraftInput } from '@/lib/engage-model';
import { draftEngagement } from '@/lib/engage';
import { requireTenant } from '@/lib/session';
import { apiError, badRequest } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const t = await requireTenant();
    const parsed = parseDraftInput(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    return NextResponse.json({ ok: true, ...(await draftEngagement(t, parsed.value)) });
  } catch (e) {
    return apiError(e, 'api/engage/draft');
  }
}
