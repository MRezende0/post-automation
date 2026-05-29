import Link from 'next/link';
import { getPendings } from '@/lib/queries';
import { fmtDateTime } from '@/lib/format';
import type { PendingApproval } from '@/lib/types';

export const dynamic = 'force-dynamic';

function DbHint({ message }: { message: string }) {
  return (
    <div className="card border-amber-900/50 bg-amber-950/20 text-sm text-amber-200">
      <p className="font-medium">Banco não acessível ainda</p>
      <p className="mt-1 text-amber-200/80">{message}</p>
      <p className="mt-2 text-amber-200/60">
        Aplique a migration <code>supabase/migrations/0002_platform_scheduling.sql</code> e confira{' '}
        <code>SUPABASE_URL</code> / <code>SUPABASE_SERVICE_KEY</code>.
      </p>
    </div>
  );
}

export default async function InboxPage() {
  let pendings: PendingApproval[] = [];
  let err = '';
  try {
    pendings = await getPendings();
  } catch (e) {
    err = e instanceof Error ? e.message : 'erro';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inbox de aprovação</h1>
        <span className="text-sm text-muted">{pendings.length} pendência(s)</span>
      </div>

      {err && <DbHint message={err} />}

      {!err && pendings.length === 0 && (
        <div className="card text-sm text-muted">Nada aguardando decisão. 🎉 Os posts gerados aparecem aqui.</div>
      )}

      <div className="grid gap-3">
        {pendings.map((p) => {
          const top = p.generation?.variations?.find((v) => v.id === p.top_id) || p.generation?.variations?.[0];
          const cover = p.images?.find((i) => i.url)?.url || null;
          return (
            <Link key={p.pending_id} href={`/inbox/${encodeURIComponent(p.pending_id)}`} className="card flex gap-4 hover:border-muted">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-edge text-muted">
                  s/ arte
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip uppercase">{p.channel}</span>
                  {p.generation?.pillar && <span className="chip">{p.generation.pillar}</span>}
                  {p.generation?.angle && <span className="chip">{p.generation.angle}</span>}
                  <span className="chip">{p.generation?.variations?.length ?? 0} variações</span>
                </div>
                <p className="mt-2 line-clamp-2 font-medium">{top?.hook || '(sem hook)'}</p>
                <p className="mt-1 text-xs text-muted">recebido {fmtDateTime(p.saved_at)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
