import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPending } from '@/lib/queries';
import { nextFreeSlot } from '@/lib/slots';
import { composeCaption } from '@/lib/caption';
import ApproveForm from '@/components/ApproveForm';

export const dynamic = 'force-dynamic';

export default async function ApprovePage({ params }: { params: Promise<{ pendingId: string }> }) {
  const { pendingId } = await params;
  const decoded = decodeURIComponent(pendingId);
  const p = await getPending(decoded);
  if (!p) notFound();

  const nextSlot = await nextFreeSlot(p.channel).catch(() => null);

  // legenda sugerida por variação (corpo + hashtags)
  const suggested: Record<number, string> = {};
  for (const v of p.generation?.variations || []) suggested[v.id] = composeCaption(v);

  return (
    <div className="space-y-4">
      <Link href="/inbox" className="text-sm text-muted hover:text-white">
        ← voltar
      </Link>
      <ApproveForm pending={p} suggested={suggested} nextSlot={nextSlot} />
    </div>
  );
}
