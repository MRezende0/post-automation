-- 0002_platform_scheduling.sql — agendamento editorial pra plataforma web.
--
-- Decisão de design: a aprovação na plataforma NÃO publica na hora. Grava a
-- decisão (legenda final + arte + horário) em scheduled_posts. Um cron
-- (Vercel Cron → /api/cron/publish-due) publica quando scheduled_for vence e
-- só ENTÃO insere em `posts` (reaproveita o caminho de markPublished do backend).
--
-- Por que tabela separada e não status em `posts`:
--   * `posts` alimenta o bandit/aprendizado (getPublishedFromDb lê tudo). Um post
--     ainda não publicado contaminaria o sinal.
--   * mantém o backend Node (queue.js/resolve.js) intacto — zero risco de regressão.
--
-- RLS: mesmo padrão das demais — ligado, sem policy pública. Só a service_role
-- (usada server-side pela plataforma Next e pelo cron) faz bypass.

-- ─────────────────────────────────────────────────────────────────────────────
-- PUBLISH_SLOTS — grade editorial recorrente. Aprovar joga o post no próximo
-- slot livre do canal. Horário em America/Sao_Paulo (UTC-03, sem DST desde 2019).
-- weekday: 0=domingo .. 6=sábado (igual Date.getDay()).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists publish_slots (
  id         uuid primary key default gen_random_uuid(),
  channel    text not null,                    -- instagram | linkedin
  weekday    int  not null check (weekday between 0 and 6),
  hour       int  not null check (hour between 0 and 23),
  minute     int  not null default 0 check (minute between 0 and 59),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists publish_slots_channel_idx on publish_slots (channel, active);

-- Grade inicial (editável na plataforma): ter/qui 18h IG, qua 12h LinkedIn.
insert into publish_slots (channel, weekday, hour, minute)
select * from (values
  ('instagram', 2, 18, 0),
  ('instagram', 4, 18, 0),
  ('linkedin',  3, 12, 0)
) as v(channel, weekday, hour, minute)
where not exists (select 1 from publish_slots);

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULED_POSTS — fila de publicação. Uma linha por post aprovado e agendado.
-- Máquina de estados: scheduled → publishing → published | failed.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists scheduled_posts (
  id                  uuid primary key default gen_random_uuid(),
  channel             text not null,                       -- instagram | linkedin
  pillar              text,
  angle               text,
  -- snapshot da variação escolhida (congelado no momento da aprovação)
  variation           jsonb not null,                      -- { id, hook, body, format, slides?, hashtags? }
  chosen_variation_id int,
  caption_final       text not null,                       -- legenda final editada (já com hashtags)
  image_url           text,                                -- arte escolhida (URL pública)
  chosen_art_id       int,
  slide_urls          jsonb,                               -- carousel: URLs já renderizadas (opcional)
  -- observabilidade herdada da geração — repassada pro posts no publish
  generation          jsonb,                               -- { prompt_hash, model, judge_reason, guardrail_flags, ... }
  seed                jsonb,
  -- agendamento + ciclo de vida
  status              text not null default 'scheduled',   -- scheduled | publishing | published | failed
  scheduled_for       timestamptz not null,                -- QUANDO publicar (≠ queue_items.scheduled_for, que é quando GERAR)
  published_at        timestamptz,
  post_id             uuid references posts(id) on delete set null,  -- post durável criado no publish
  attempts            int not null default 0,
  last_error          text,
  source_pending_id   text,                                -- pending_approvals.pending_id de origem (auditoria)
  approved_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- o cron varre por (status, scheduled_for); índice parcial deixa barato
create index if not exists scheduled_due_idx on scheduled_posts (scheduled_for) where status = 'scheduled';
create index if not exists scheduled_status_idx on scheduled_posts (status, scheduled_for desc);
create index if not exists scheduled_channel_idx on scheduled_posts (channel, scheduled_for);

-- toca updated_at a cada update
create or replace function touch_scheduled_posts() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists scheduled_posts_touch on scheduled_posts;
create trigger scheduled_posts_touch before update on scheduled_posts
  for each row execute function touch_scheduled_posts();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — liga nas novas; sem policy pública. Acesso só via service_role (bypass).
-- ─────────────────────────────────────────────────────────────────────────────
alter table publish_slots   enable row level security;
alter table scheduled_posts enable row level security;

revoke all on publish_slots   from anon, authenticated;
revoke all on scheduled_posts from anon, authenticated;
