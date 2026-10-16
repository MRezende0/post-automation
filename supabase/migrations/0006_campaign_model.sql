-- 0006_campaign_model.sql: campanha, brief, ativo e distribuição (ADR 0001, SPEC 001 R2).
--
-- Aditivo e seguro: tabelas novas e colunas nulas. O fluxo atual (um post por canal,
-- sem brief) continua igual. scheduled_posts É a distribuição: ganha os vínculos e o UTM.
-- RLS: mesmo padrão das outras tabelas (service_role bypassa; anon/authenticated sem acesso).

-- ─────────────────────────────────────────────────────────────────────────────
-- CAMPAIGNS: objetivo, KPI, fase e janela. Fonte nesta fase: content/campaigns.yaml
-- (sync por slug em src/utils/campaign-sync.js).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists campaigns (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null default 'pilar',
  slug         text not null,                 -- vira utm_campaign
  name         text not null,
  objective    text,
  kpi          text,                          -- ex: cadastro_ativado
  phase        text,                          -- ex: B, C, T0
  start_date   date,
  end_date     date,
  context      text,                          -- tema injetado no prompt
  pillar       text,
  angle        text,
  formats_mix  jsonb,                         -- ex: {"instagram":["carousel","reel"],"linkedin":["text"]}
  budget_brl   numeric,
  status       text not null default 'active', -- active | paused | archived
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists campaigns_window_idx on campaigns (tenant_id, start_date, end_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- BRIEFS: uma ideia central da semana. Todos os ativos dela compartilham
-- pilar, ângulo e evidência.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists briefs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null default 'pilar',
  campaign_id  uuid references campaigns(id) on delete set null,
  week_of      date,                          -- segunda-feira da semana
  pillar       text,
  angle        text,
  idea         text not null,
  evidence     text,
  cta          text,
  status       text not null default 'planned', -- planned | producing | ready | approved | dropped
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists briefs_week_idx on briefs (tenant_id, week_of, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- ASSETS: uma peça renderizada de um brief.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists assets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null default 'pilar',
  brief_id     uuid references briefs(id) on delete cascade,
  kind         text not null,                 -- text | image | carousel | document | video | thread | story
  status       text not null default 'rendering', -- rendering | ready | failed
  caption      text,
  hashtags     jsonb,
  media        jsonb,                         -- { image, slides[], pdf, video, cover, duration_s }
  script       jsonb,                         -- roteiro de vídeo (normalizeReelScript)
  source       text not null default 'generated', -- generated | human_cut | manual
  generation   jsonb,                         -- observabilidade (prompt_hash, model, judge...)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists assets_brief_idx on assets (brief_id);
create index if not exists assets_status_idx on assets (tenant_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULED_POSTS vira a distribuição: ativo × canal × horário, com UTM.
-- ─────────────────────────────────────────────────────────────────────────────
alter table scheduled_posts add column if not exists asset_id     uuid references assets(id) on delete set null;
alter table scheduled_posts add column if not exists brief_id     uuid references briefs(id) on delete set null;
alter table scheduled_posts add column if not exists campaign_id  uuid references campaigns(id) on delete set null;
alter table scheduled_posts add column if not exists media_kind   text;   -- image | carousel | text | document | video | thread | story
alter table scheduled_posts add column if not exists video_url    text;
alter table scheduled_posts add column if not exists document_url text;
alter table scheduled_posts add column if not exists utm          jsonb;  -- { source, medium, campaign, content, url }
create index if not exists scheduled_campaign_idx on scheduled_posts (campaign_id);
-- utm_content é a chave que o Pilar devolve no ops-export-funil
create index if not exists scheduled_utm_content_idx on scheduled_posts ((utm->>'content'));

-- posts (histórico) aponta pra distribuição que o publicou → métrica e funil por peça
alter table posts add column if not exists scheduled_post_id uuid references scheduled_posts(id) on delete set null;
create index if not exists posts_scheduled_post_idx on posts (scheduled_post_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at automático (reaproveita o padrão de 0002)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists campaigns_touch on campaigns;
create trigger campaigns_touch before update on campaigns for each row execute function touch_updated_at();
drop trigger if exists briefs_touch on briefs;
create trigger briefs_touch before update on briefs for each row execute function touch_updated_at();
drop trigger if exists assets_touch on assets;
create trigger assets_touch before update on assets for each row execute function touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table campaigns enable row level security;
alter table briefs    enable row level security;
alter table assets    enable row level security;
revoke all on campaigns, briefs, assets from anon, authenticated;
-- grant explícito: projeto Supabase novo não concede mais tabela nova às roles da API.
grant all on campaigns, briefs, assets to service_role;
