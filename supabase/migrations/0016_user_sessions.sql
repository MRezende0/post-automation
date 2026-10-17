-- 0016_user_sessions.sql: o que a sessão por pessoa precisa em `users` (SPEC 009).
--
-- session_version: entra na sessão assinada; subir o número derruba todas as sessões da pessoa
--   ("sair de todos os dispositivos").
-- last_tenant_id: a conta em que a pessoa estava, para o próximo login abrir nela.
-- last_login_at: último login aceito.
--
-- Aditivo e reaplicável (o CI roda duas vezes).

alter table users add column if not exists session_version integer not null default 1 check (session_version > 0);
alter table users add column if not exists last_tenant_id text references tenants(id) on delete set null;
alter table users add column if not exists last_login_at timestamptz;
