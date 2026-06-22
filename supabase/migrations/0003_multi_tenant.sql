-- 0003_multi_tenant.sql — isolamento por tenant (cliente).
--
-- Aditivo e seguro: adiciona `tenant_id text not null default 'pilar'` em todas
-- as tabelas de dados. Registros existentes (Pilar) recebem 'pilar'
-- automaticamente via DEFAULT — sem backfill manual.
--
-- O FILTRO/ESCRITA por tenant é feito na aplicação (src/utils/queue.js,
-- src/metrics.js): o backend roda um tenant por job (env TENANT_ID, default
-- 'pilar'), então o escopo é por execução. Com só a Pilar no DB, o filtro
-- `tenant_id='pilar'` é idêntico ao comportamento atual; passa a isolar quando
-- entrar um 2º tenant.
--
-- RLS por tenant fica para quando o cockpit tiver auth por cliente. Hoje o
-- acesso é só via service_role (bypass + anon/authenticated revogados), então o
-- isolamento real é na camada da aplicação. As policies de 0001/0002 seguem.

-- ─────────────────────────────────────────────────────────────────────────────
-- Coluna tenant_id em todas as tabelas de dados
-- ─────────────────────────────────────────────────────────────────────────────
alter table posts             add column if not exists tenant_id text not null default 'pilar';
alter table post_variants     add column if not exists tenant_id text not null default 'pilar';
alter table metrics_snapshots add column if not exists tenant_id text not null default 'pilar';
alter table post_events       add column if not exists tenant_id text not null default 'pilar';
alter table queue_items       add column if not exists tenant_id text not null default 'pilar';
alter table pending_approvals add column if not exists tenant_id text not null default 'pilar';
alter table rejected_posts    add column if not exists tenant_id text not null default 'pilar';
alter table bandit_snapshots  add column if not exists tenant_id text not null default 'pilar';
alter table scheduled_posts   add column if not exists tenant_id text not null default 'pilar';
alter table publish_slots     add column if not exists tenant_id text not null default 'pilar';
alter table prompt_versions   add column if not exists tenant_id text not null default 'pilar';

-- ─────────────────────────────────────────────────────────────────────────────
-- pending_approvals: era UM pending por canal; agora um por (tenant, canal).
-- ─────────────────────────────────────────────────────────────────────────────
drop index if exists pending_channel_idx;
create unique index if not exists pending_tenant_channel_idx on pending_approvals (tenant_id, channel);

-- ─────────────────────────────────────────────────────────────────────────────
-- Índices de leitura escopados por tenant (o bandit lê só os posts reais do
-- tenant; o cron varre só os agendados do tenant).
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists posts_tenant_published_idx on posts (tenant_id, published_at desc);
create index if not exists posts_tenant_real_idx       on posts (tenant_id, published_at desc) where is_dry_run = false;
create index if not exists queue_tenant_pending_idx     on queue_items (tenant_id, scheduled_for nulls first) where consumed_at is null;
create index if not exists scheduled_tenant_due_idx     on scheduled_posts (tenant_id, scheduled_for) where status = 'scheduled';
