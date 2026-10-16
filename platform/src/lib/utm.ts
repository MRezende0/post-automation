// utm.ts: UTM de cada distribuição (SPEC 001 R1). O utm_content é o id curto da
// distribuição (scheduled_posts.id); é a chave que o Pilar devolve no ops-export-funil
// com cadastros, ativados e pagantes. Puro, sem I/O (testado em tests/utm.test.js).

import type { Channel } from './types';

export type Utm = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  url: string;
};

export type LinkPolicy = 'first_comment' | 'reply' | 'bio';

export const DEFAULT_SITE_URL = 'https://pilarsoft.com.br';

// Campanha padrão quando nenhuma está ativa (rotação de pilares).
export const ALWAYS_ON_CAMPAIGN = 'sempre-on';

// Onde o link entra em cada canal. LinkedIn e X punem link no corpo; no feed do
// Instagram link não é clicável, então vai na bio com o UTM da campanha.
export const LINK_POLICY: Record<Channel, LinkPolicy> = {
  instagram: 'bio',
  linkedin: 'first_comment',
};

const SOURCE_BY_CHANNEL: Record<Channel, string> = {
  instagram: 'instagram',
  linkedin: 'linkedin',
};

export function shortId(uuid: string): string {
  const hex = String(uuid || '').replace(/-/g, '').toLowerCase();
  if (hex.length < 8) throw new Error(`id de distribuição inválido: "${uuid}"`);
  return `d${hex.slice(0, 8)}`;
}

export function withUtm(baseUrl: string, params: Omit<Utm, 'url'>): string {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', params.source);
  url.searchParams.set('utm_medium', params.medium);
  url.searchParams.set('utm_campaign', params.campaign);
  url.searchParams.set('utm_content', params.content);
  return url.toString();
}

export function distributionUtm(input: {
  channel: Channel;
  distributionId: string;
  campaignSlug?: string | null;
  medium?: string;
  baseUrl?: string;
}): Utm {
  const params = {
    source: SOURCE_BY_CHANNEL[input.channel],
    medium: input.medium || 'organico',
    campaign: input.campaignSlug || ALWAYS_ON_CAMPAIGN,
    content: shortId(input.distributionId),
  };
  return { ...params, url: withUtm(input.baseUrl || DEFAULT_SITE_URL, params) };
}

// Link da bio do Instagram: atribuição por campanha (o feed não tem link por post).
export function bioLink(input: { campaignSlug?: string | null; baseUrl?: string } = {}): string {
  return withUtm(input.baseUrl || DEFAULT_SITE_URL, {
    source: 'instagram',
    medium: 'bio',
    campaign: input.campaignSlug || 'perfil',
    content: 'bio',
  });
}

export function linkCommentText(utm: Utm): string {
  return `Teste a Pilar grátis por 3 dias: ${utm.url}`;
}
