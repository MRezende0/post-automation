import { NextResponse } from 'next/server';
import { rejectPending } from '@/lib/scheduling';
import { parseFeedbackInput } from '@/lib/learning';
import { saveFeedback } from '@/lib/feedback';

// Rejeitar pede o feedback junto (SPEC 003 R3.4/R4.2): a nota vira o motivo do anti-exemplo
// e o feedback estruturado entra no prompt das próximas gerações.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pendingId, reason, feedback } = body ?? {};
    if (!pendingId) return NextResponse.json({ error: 'pendingId obrigatório' }, { status: 400 });

    let parsedFeedback = null;
    if (feedback) {
      const parsed = parseFeedbackInput({ ...feedback, pending_id: pendingId });
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      parsedFeedback = parsed.value;
    }

    const why = parsedFeedback ? `${parsedFeedback.aspect}: ${parsedFeedback.note}` : reason ? String(reason) : undefined;
    await rejectPending(String(pendingId), why);
    if (parsedFeedback) await saveFeedback(parsedFeedback);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
