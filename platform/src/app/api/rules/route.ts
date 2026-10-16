import { NextResponse } from 'next/server';
import { parseRuleInput, parseRulePatch } from '@/lib/learning';
import { createRule, updateRule } from '@/lib/feedback';
import { requireTenant } from '@/lib/session';
import { apiError, badRequest } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const t = await requireTenant();
    const parsed = parseRuleInput(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const id = await createRule(t, parsed.value);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return apiError(e, 'api/rules');
  }
}

export async function PATCH(req: Request) {
  try {
    const t = await requireTenant();
    const parsed = parseRulePatch(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    await updateRule(t, parsed.value.id, parsed.value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, 'api/rules');
  }
}
