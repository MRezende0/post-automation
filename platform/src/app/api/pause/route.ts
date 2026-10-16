import { NextResponse } from 'next/server';
import { setPause } from '@/lib/pause';
import { notify, escapeHtml } from '@/lib/telegram';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body?.paused !== 'boolean') {
      return NextResponse.json({ error: 'Campo "paused" (true ou false) é obrigatório' }, { status: 400 });
    }
    const state = await setPause(body.paused, typeof body.reason === 'string' ? body.reason : null);
    await notify(
      state.paused
        ? `⏸️ Publicação pausada${state.reason ? `: ${escapeHtml(state.reason)}` : ''}. Nada sai até retomar.`
        : '▶️ Publicação retomada. Os agendados vencidos saem no próximo ciclo.',
    );
    return NextResponse.json({ ok: true, ...state });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 });
  }
}
