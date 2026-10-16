import { NextResponse } from 'next/server';
import { parseRuleInput, parseRulePatch } from '@/lib/learning';
import { createRule, updateRule } from '@/lib/feedback';

export async function POST(req: Request) {
  try {
    const parsed = parseRuleInput(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const id = await createRule(parsed.value);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const parsed = parseRulePatch(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    await updateRule(parsed.value.id, parsed.value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 });
  }
}
