import { getSlots, getActiveCampaign } from '@/lib/queries';
import { bioLink } from '@/lib/utm';
import SlotEditor from '@/components/SlotEditor';
import type { PublishSlot, Campaign } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let slots: PublishSlot[] = [];
  let campaign: Campaign | null = null;
  let err = '';
  try {
    [slots, campaign] = await Promise.all([getSlots(), getActiveCampaign()]);
  } catch (e) {
    err = e instanceof Error ? e.message : 'erro';
  }
  const bio = bioLink({ campaignSlug: campaign?.slug, baseUrl: process.env.SITE_URL });

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

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Link da bio do Instagram</h2>
        <p className="text-sm text-muted">
          {campaign
            ? `Campanha ativa: ${campaign.name}. Troque o link da bio quando a campanha mudar.`
            : 'Nenhuma campanha ativa. O link mede o perfil como um todo.'}
        </p>
        <code className="card block break-all text-xs">{bio}</code>
      </div>
    </div>
  );
}
