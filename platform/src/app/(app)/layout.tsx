import Nav from '@/components/Nav';
import { countByStatus } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let badges = { pendings: 0, failed: 0 };
  try {
    const c = await countByStatus();
    badges = { pendings: c.pendings, failed: c.failed };
  } catch {
    // sem DB ainda (migration não aplicada) — segue sem badges
  }
  return (
    <div className="min-h-screen">
      <Nav badges={badges} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
