import { NextResponse } from 'next/server';
import { parseDraftInput } from '@/lib/engage-model';
import { draftEngagement } from '@/lib/engage';

export async function POST(req: Request) {
  try {
    const parsed = parseDraftInput(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await draftEngagement(parsed.value)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 });
  }
}
