-- 0014_notifications.sql: avisos da conta no lugar do Telegram (SPEC 007).
--
-- 1. `notifications`: cada aviso (publicou, falhou, post pronto para aprovar, relatório) vira
--    uma linha do tenant. Jobs e plataforma gravam pela service role; membro do tenant só lê.
--    Texto puro, sem HTML: quem mostra escapa. Lido/não lido por pessoa entra com a tela.
-- 2. `pending_approvals` perde as colunas do fluxo do Telegram (teclado e espera do motivo), e
--    as pendências que esperavam um clique (escolha de arte, motivo da rejeição) voltam para a
--    inbox.
--
-- Reaplicável (o CI roda duas vezes).

create table if not exists notifications (
  id          bigint generated always as identity primary key,
  tenant_id   text not null references tenants(id) on delete cascade,
  kind        text not null,
  level       text not null default 'info' check (level in ('info', 'warning', 'error')),
  title       text not null check (char_length(title) <= 200),
  body        text,
  link        text check (link is null or link like '/%'),
  created_at  timestamptz not null default now()
);

create index if not exists notifications_tenant_recent on notifications (tenant_id, created_at desc);

alter table notifications enable row level security;
drop policy if exists tenant_select on notifications;
create policy tenant_select on notifications for select to authenticated using (app.is_tenant_member(tenant_id));
revoke all on notifications from anon, authenticated;
grant select on notifications to authenticated;
grant all on notifications to service_role;

update pending_approvals set status = 'awaiting_decision' where status in ('awaiting_art', 'awaiting_reason');
alter table pending_approvals drop column if exists message_ids;
alter table pending_approvals drop column if exists keyboard_message_id;
alter table pending_approvals drop column if exists reason_requested_at;
