import { NextResponse } from 'next/server';
import { parseRework } from '@/lib/ideas-model';
import { requestRework } from '@/lib/ideas';

export async function POST(req: Request) {
  try {
    const parsed = parseRework(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    await requestRework(parsed.value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 400 });
  }
}
