-- 0001_init_schema.sql — schema event-sourced do post-automation.
-- Substitui o estado em YAML (content/*.yaml) por Postgres com atribuição causal.
-- Aplicar no SQL Editor do Supabase OU via `supabase db push`.
--
-- Princípios:
--   * posts        = registro durável de cada publicação (era published.yaml)
--   * post_variants = TODAS as variações geradas (hoje só sobrevive a escolhida)
--   * metrics_snapshots = série temporal (hoje só guarda a última coleta)
--   * post_events  = log imutável (brief→variants→judge→approve→publish→metrics)
--   * observabilidade: prompt_hash, model, examples_used, rag_chunks, judge_reason
--
-- RLS: ligado em tudo, SEM policy pública. O backend (GitHub Actions) usa a
-- service_role key, que faz bypass de RLS. Não há acesso client-side → cofre fechado.

-- ─────────────────────────────────────────────────────────────────────────────
-- POSTS — uma linha por publicação (canal único por linha, como o pipeline faz hoje)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists posts (
  id              uuid primary key default gen_random_uuid(),
  pillar          text not null,
  angle           text,
  channel         text not null,                         -- instagram | linkedin
  context         text,
  hook            text,
  body            text,
  format          text default 'single',                 -- single | carousel
  chosen_variation int,
  channels        jsonb not null default '{}'::jsonb,     -- resultado bruto por canal
  is_dry_run      boolean not null default false,
  -- observabilidade / atribuição causal
  prompt_hash     text,
  model           text,
  examples_used   jsonb,                                  -- few-shot ativos na geração
  rag_chunks      jsonb,                                  -- trechos RAG injetados
  judge_reason    text,
  guardrail_flags text[],
  -- aprendizado (score normalizado mais recente; histórico fica em metrics_snapshots)
  engagement_score numeric,
  generated_at    timestamptz,
  published_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists posts_pillar_idx       on posts (pillar);
create index if not exists posts_pillar_angle_idx on posts (pillar, angle);
create index if not exists posts_published_idx    on posts (published_at desc);
-- só posts reais alimentam o bandit; índice parcial deixa a query barata
create index if not exists posts_real_idx on posts (published_at desc) where is_dry_run = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- POST_VARIANTS — as N variações geradas (pra calibrar o judge depois:
-- a escolhida realmente engajou mais que as descartadas?)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists post_variants (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references posts(id) on delete cascade,
  variation_id    int not null,                           -- 1..N do gerador
  hook            text,
  body            text,
  format          text,
  slides          jsonb,
  heuristic_score numeric,                                -- score do rankVariations
  was_chosen      boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists post_variants_post_idx on post_variants (post_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- METRICS_SNAPSHOTS — série temporal de engajamento (vê crescimento, não só o fim)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists metrics_snapshots (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid not null references posts(id) on delete cascade,
  channel          text not null,
  likes            int,
  comments         int,
  saves            int,
  shares           int,
  reach            int,
  impressions      int,
  engagement_score numeric,                               -- score normalizado neste ponto
  raw              jsonb,                                 -- payload bruto da API
  captured_at      timestamptz not null default now()
);
create index if not exists metrics_post_idx on metrics_snapshots (post_id, captured_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- POST_EVENTS — log imutável do ciclo de vida (event sourcing / auditoria)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists post_events (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references posts(id) on delete cascade,
  type       text not null,    -- brief|variants_generated|judge_decision|edited|approved|rejected|published|metrics_snapshot
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists post_events_post_idx on post_events (post_id, created_at);
create index if not exists post_events_type_idx on post_events (type, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- QUEUE_ITEMS — fila de entrada (era queue.yaml). consumed_at em vez de delete → auditável
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists queue_items (
  id            uuid primary key default gen_random_uuid(),
  pillar        text,
  angle         text,
  context       text,
  channels      text[] default '{instagram}',
  scheduled_for timestamptz,
  consumed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists queue_pending_idx on queue_items (scheduled_for nulls first) where consumed_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- PENDING_APPROVALS — estado transitório de aprovação (era pending-approval.yaml)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists pending_approvals (
  id                  uuid primary key default gen_random_uuid(),
  pending_id          text unique not null,
  channel             text not null,
  generation          jsonb not null,
  top_id              int,
  images              jsonb,
  seed                jsonb,
  message_ids         bigint[],
  keyboard_message_id bigint,
  regen_count         int not null default 0,
  status              text not null default 'awaiting_decision', -- awaiting_decision | awaiting_reason
  reason_requested_at timestamptz,
  saved_at            timestamptz not null default now()
);
-- um pending por canal (espelha savePending, que sobrescreve por canal)
create unique index if not exists pending_channel_idx on pending_approvals (channel);

-- ─────────────────────────────────────────────────────────────────────────────
-- REJECTED_POSTS — anti-exemplos (era rejected.yaml)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists rejected_posts (
  id          uuid primary key default gen_random_uuid(),
  pillar      text,
  angle       text,
  channel     text,
  hook        text,
  body        text,
  format      text,
  reason      text,
  rejected_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROMPT_VERSIONS — rastreia versões de prompt (atribuição: qual prompt gerou o quê)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists prompt_versions (
  hash       text primary key,            -- sha256 do template renderizado
  role       text not null,               -- system | channel | pillar | judge | polish
  template   text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BANDIT_SNAPSHOTS — fotografia dos posteriores Beta (observabilidade do aprendizado)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists bandit_snapshots (
  id          uuid primary key default gen_random_uuid(),
  dimension   text not null,              -- pillar | angle
  arm         text not null,
  pillar      text,                       -- p/ ângulo: pilar pai
  alpha       numeric not null,
  beta        numeric not null,
  n           int not null default 0,
  captured_at timestamptz not null default now()
);
create index if not exists bandit_snapshots_idx on bandit_snapshots (dimension, captured_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — liga em todas; sem policy pública. Acesso só via service_role (bypass).
-- ─────────────────────────────────────────────────────────────────────────────
alter table posts             enable row level security;
alter table post_variants     enable row level security;
alter table metrics_snapshots enable row level security;
alter table post_events       enable row level security;
alter table queue_items       enable row level security;
alter table pending_approvals enable row level security;
alter table rejected_posts    enable row level security;
alter table prompt_versions   enable row level security;
alter table bandit_snapshots  enable row level security;

-- Defense-in-depth: nega na camada de PRIVILÉGIO, não só no RLS. O Supabase
-- concede SELECT/INSERT/... a anon/authenticated por padrão; sem revogar, os
-- endpoints REST ficam "ligados" (vazios pelo RLS hoje, mas armadilha futura).
-- service_role tem BYPASSRLS e mantém acesso total.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
-- e impede que tabelas FUTURAS herdem grant pra esses roles
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
