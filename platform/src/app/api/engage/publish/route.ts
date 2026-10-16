import { NextResponse } from 'next/server';
import { parseCommentText } from '@/lib/engage-model';
import { publishEngagement } from '@/lib/engage';

export async function POST(req: Request) {
  try {
    const parsed = parseCommentText(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const result = await publishEngagement(parsed.value.id, parsed.value.text);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro', offerCopy: true }, { status: 500 });
  }
}
