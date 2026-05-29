// Tipos compartilhados — espelham as tabelas do Supabase relevantes pra plataforma.

export type Channel = 'instagram' | 'linkedin';

export type Variation = {
  id: number;
  hook?: string;
  body?: string;
  format?: 'single' | 'carousel';
  slides?: unknown[];
  hashtags?: string[];
};

export type ImageRef = { id: number; url: string | null; path?: string };

// Observabilidade herdada da geração — repassada ao posts no publish.
export type Generation = {
  pillar?: string;
  angle?: string | null;
  variations: Variation[];
  model?: string;
  prompt_hash?: string;
  judge_reason?: string;
  judge_scores?: unknown;
  critic?: unknown;
  guardrail_flags?: string[];
  heuristic_scores?: Record<string, number>;
};

export type PendingApproval = {
  id: string;
  pending_id: string;
  channel: Channel;
  generation: Generation;
  top_id?: number;
  images?: ImageRef[];
  seed?: Record<string, unknown>;
  regen_count: number;
  status: string;
  saved_at: string;
};

export type ScheduledStatus = 'scheduled' | 'publishing' | 'published' | 'failed';

export type ScheduledPost = {
  id: string;
  channel: Channel;
  pillar?: string | null;
  angle?: string | null;
  variation: Variation;
  chosen_variation_id?: number | null;
  caption_final: string;
  image_url?: string | null;
  chosen_art_id?: number | null;
  slide_urls?: string[] | null;
  generation?: Generation | null;
  seed?: Record<string, unknown> | null;
  status: ScheduledStatus;
  scheduled_for: string;
  published_at?: string | null;
  post_id?: string | null;
  attempts: number;
  last_error?: string | null;
  source_pending_id?: string | null;
  approved_at: string;
  created_at: string;
  updated_at: string;
};

export type PublishSlot = {
  id: string;
  channel: Channel;
  weekday: number; // 0=domingo .. 6=sábado
  hour: number;
  minute: number;
  active: boolean;
};

export type PublishedPost = {
  id: string;
  pillar: string;
  angle?: string | null;
  channel: Channel;
  hook?: string | null;
  body?: string | null;
  format?: string | null;
  channels: Record<string, unknown>;
  engagement_score?: number | null;
  published_at?: string | null;
};
