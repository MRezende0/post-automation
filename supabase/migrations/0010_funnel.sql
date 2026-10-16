-- 0010_funnel.sql: funil da Pilar por UTM (SPEC 004). A Pilar devolve, por dia de cadastro e
-- UTM, quantos cadastros, ativados e pagantes vieram; a coleta regrava a janela inteira a cada
-- rodada porque ativado e pagante mudam depois. UTM ausente é gravado como '' (cabe na chave).

create table if not exists funnel_daily (
  tenant_id     text not null default 'pilar',
  day           date not null,                 -- dia do cadastro (Brasília)
  utm_source    text not null default '',
  utm_medium    text not null default '',
  utm_campaign  text not null default '',
  utm_content   text not null default '',     -- 'd' + 8 hex = id curto da distribuição
  cadastros     int  not null default 0,
  ativados      int  not null default 0,
  pagantes      int  not null default 0,
  fetched_at    timestamptz not null default now(),
  primary key (tenant_id, day, utm_source, utm_medium, utm_campaign, utm_content)
);
create index if not exists funnel_daily_content_idx on funnel_daily (tenant_id, utm_content);

-- Total por post, recalculado a cada coleta. Entra na recompensa do bandit.
alter table posts add column if not exists funnel jsonb;

alter table funnel_daily enable row level security;
revoke all on funnel_daily from anon, authenticated;
grant all on funnel_daily to service_role;
