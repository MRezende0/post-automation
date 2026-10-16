-- 0013_tenant_contract.sql: fecha o expand/contract do tenant (ADR 0005, SPEC 006 F2).
--
-- 1. Tira o `default 'pilar'` de toda coluna tenant_id. A 0003 pôs o default para o código
--    antigo seguir funcionando; agora toda escrita da plataforma (tenantDb) e dos jobs
--    (tests/node-tenant-audit.test.js) carimba o tenant. Insert que esquecer passa a falhar
--    em voz alta em vez de cair em silêncio na Pilar.
-- 2. Tenant novo nasce PAUSADO (trigger). Sem linha em publishing_controls o scheduler
--    publica, então um tenant criado e ainda sem credencial ou slots poderia tentar sair.
--    Quem cria o tenant retoma a publicação depois de configurar.
--
-- Reaplicável (o CI roda duas vezes). Aditivo no dado: não apaga nem muda linha existente.

do $$
declare r record;
begin
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'tenant_id' and column_default is not null
  loop
    execute format('alter table public.%I alter column tenant_id drop default', r.table_name);
  end loop;
end $$;

create or replace function app.seed_new_tenant() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.publishing_controls (tenant_id, paused, reason, paused_at)
  values (new.id, true, 'tenant novo: configure e retome a publicação', now())
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

revoke execute on function app.seed_new_tenant() from public;

drop trigger if exists tenants_seed on tenants;
create trigger tenants_seed after insert on tenants for each row execute function app.seed_new_tenant();
