import { getSlots } from '@/lib/queries';
import SlotEditor from '@/components/SlotEditor';
import type { PublishSlot } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let slots: PublishSlot[] = [];
  let err = '';
  try {
    slots = await getSlots();
  } catch (e) {
    err = e instanceof Error ? e.message : 'erro';
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Slots editoriais</h1>
        <p className="text-sm text-muted">
          Grade recorrente por canal. Aprovar um post o joga no próximo slot livre. Horário no fuso editorial (BRT).
        </p>
      </div>
      {err && <div className="card border-amber-900/50 bg-amber-950/20 text-sm text-amber-200">{err}</div>}
      <SlotEditor initial={slots} />
    </div>
  );
}
