import { NextResponse } from 'next/server';
import { parseCommentText } from '@/lib/engage-model';
import { markCopied } from '@/lib/engage';

export async function POST(req: Request) {
  try {
    const parsed = parseCommentText(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    await markCopied(parsed.value.id, parsed.value.text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 });
  }
}
