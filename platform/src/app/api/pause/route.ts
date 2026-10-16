import { NextResponse } from 'next/server';
import { setPause } from '@/lib/pause';
import { notify, escapeHtml } from '@/lib/telegram';
import { requireTenant } from '@/lib/session';
import { parsePause } from '@/lib/route-input';
import { apiError, badRequest } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const t = await requireTenant();
    const parsed = parsePause(await req.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    const state = await setPause(t, parsed.value.paused, parsed.value.reason);
    await notify(
      state.paused
        ? `⏸️ Publicação pausada${state.reason ? `: ${escapeHtml(state.reason)}` : ''}. Nada sai até retomar.`
        : '▶️ Publicação retomada. Os agendados vencidos saem no próximo ciclo.',
    );
    return NextResponse.json({ ok: true, ...state });
  } catch (e) {
    return apiError(e, 'api/pause');
  }
}
