-- 0008_publishing_pause.sql: pausa global de publicação por tenant. Com paused = true o
-- scheduler (/api/cron/publish-due) não publica nada; os agendados ficam esperando.
-- Aditivo. Sem linha = não pausado.

create table if not exists publishing_controls (
  tenant_id   text primary key default 'pilar',
  paused      boolean not null default false,
  reason      text,
  paused_at   timestamptz,
  updated_at  timestamptz not null default now()
);

alter table publishing_controls enable row level security;
revoke all on publishing_controls from anon, authenticated;
grant all on publishing_controls to service_role;
