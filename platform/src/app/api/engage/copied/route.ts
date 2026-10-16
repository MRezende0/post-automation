import { NextResponse } from 'next/server';
import { parseCommentText } from '@/lib/engage-model';
import { markCopied } from '@/lib/engage';
import { requireTenant } from '@/lib/session';
import { apiError, badRequest } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const t = await requireTenant();
    const parsed = parseCommentText(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    await markCopied(t, parsed.value.id, parsed.value.text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, 'api/engage/copied');
  }
}
