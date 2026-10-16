import { NextResponse } from 'next/server';
import { parseApproveIdea } from '@/lib/ideas-model';
import { approveIdea } from '@/lib/ideas';

export async function POST(req: Request) {
  try {
    const parsed = parseApproveIdea(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const result = await approveIdea(parsed.value.briefId, parsed.value.items);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 400 });
  }
}
