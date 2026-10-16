import Nav from '@/components/Nav';
import Link from 'next/link';
import { countByStatus } from '@/lib/queries';
import { getPauseState, type PauseState } from '@/lib/pause';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let badges = { pendings: 0, failed: 0 };
  let pause: PauseState | null = null;
  try {
    const [c, p] = await Promise.all([countByStatus(), getPauseState()]);
    badges = { pendings: c.pendings, failed: c.failed };
    pause = p;
  } catch {
    // sem DB ainda (migration não aplicada) — segue sem badges
  }
  return (
    <div className="min-h-screen">
      <Nav badges={badges} />
      {pause?.paused && (
        <div className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-100">
          Publicação pausada{pause.pausedAt ? ` desde ${fmtDateTime(pause.pausedAt)}` : ''}. Nada sai até você retomar.{' '}
          <Link href="/settings" className="underline underline-offset-2">
            Retomar em Configurações
          </Link>
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
