import { getScheduled } from '@/lib/queries';
import { fmtDate, fmtTime } from '@/lib/format';
import ScheduledCard from '@/components/ScheduledCard';
import type { ScheduledPost } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  let posts: ScheduledPost[] = [];
  let err = '';
  try {
    posts = await getScheduled(['scheduled', 'publishing', 'failed']);
  } catch (e) {
    err = e instanceof Error ? e.message : 'erro';
  }

  // agrupa por dia (no fuso editorial)
  const groups = new Map<string, ScheduledPost[]>();
  for (const p of posts) {
    const key = fmtDate(p.scheduled_for);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const failed = posts.filter((p) => p.status === 'failed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <span className="text-sm text-muted">{posts.length} na fila</span>
      </div>

      {err && (
        <div className="card border-amber-900/50 bg-amber-950/20 text-sm text-amber-200">{err}</div>
      )}

      {failed.length > 0 && (
        <div className="card border-red-900/50 bg-red-950/20 text-sm text-red-200">
          {failed.length} post(s) falharam na publicação — veja abaixo e re-tente.
        </div>
      )}

      {!err && posts.length === 0 && (
        <div className="card text-sm text-muted">Fila vazia. Aprove pendências na Inbox pra agendar.</div>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([day, items]) => (
          <div key={day} className="space-y-2">
            <h2 className="label">{day}</h2>
            <div className="grid gap-2">
              {items.map((p) => (
                <ScheduledCard key={p.id} post={p} time={fmtTime(p.scheduled_for)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
