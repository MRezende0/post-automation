-- bootstrap.sql: o mínimo do Supabase para rodar as migrations num Postgres puro (CI, teste
-- local e o Cloud SQL). Os papéis da API valem sempre; o schema `auth` só existe porque as
-- migrations antigas (até a 0014) o citam: desde a 0015 nada ativo depende dele (SPEC 008).
-- Nunca roda num projeto Supabase de verdade: lá tudo isto já existe.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Mesma leitura do Supabase: o `sub` do JWT que o PostgREST põe em request.jwt.claims.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
