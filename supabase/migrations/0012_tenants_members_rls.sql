-- 0012_tenants_members_rls.sql: fundação do SaaS (SPEC 006 F1, ADR 0005).
--
-- Até aqui o isolamento era "tudo ou nada": RLS ligado sem policy e só a service_role
-- entrava. Esta migration cria o dono de cada linha (tenants), quem pertence a ele
-- (tenant_members, ligado ao Supabase Auth) e as policies por tenant em TODAS as tabelas
-- com tenant_id. A plataforma continua na service_role até o login por usuário entrar;
-- quando entrar, o banco já isola sozinho.
--
-- Aditivo e reaplicável (o CI roda duas vezes). Nada é apagado.
--
-- Papéis do tenant:
--   owner, admin, editor  leem e escrevem o que é editorial (aprovar, agendar, feedback)
--   viewer                só lê
-- O que os jobs gravam (posts, métricas, snapshots, funil) é só leitura pelo usuário:
-- quem escreve ali é a service_role.

-- ─────────────────────────────────────────────────────────────────────────────
-- TENANTS e MEMBROS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tenants (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name        text not null check (length(trim(name)) > 0),
  status      text not null default 'active' check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now()
);

-- Todo dado existente é da Pilar (default de tenant_id desde a 0003).
insert into tenants (id, name) values ('pilar', 'Pilar') on conflict (id) do nothing;

create table if not exists tenant_members (
  tenant_id   text not null references tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists tenant_members_user_idx on tenant_members (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPERS de policy. Schema `app` não é exposto pelo PostgREST, então nenhum dos dois
-- vira RPC chamável. SECURITY DEFINER para ler tenant_members sem depender da RLS dela
-- (evita recursão), com search_path vazio e o usuário vindo SEMPRE de auth.uid(),
-- nunca de parâmetro.
-- ─────────────────────────────────────────────────────────────────────────────
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

create or replace function app.is_tenant_member(p_tenant text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = p_tenant and m.user_id = auth.uid()
  );
$$;

create or replace function app.can_edit_tenant(p_tenant text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = p_tenant and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'editor')
  );
$$;

-- CREATE FUNCTION nasce executável por PUBLIC (e anon herda de PUBLIC). Fecha e abre
-- só para quem avalia policy.
revoke execute on function app.is_tenant_member(text) from public;
revoke execute on function app.can_edit_tenant(text) from public;
grant execute on function app.is_tenant_member(text) to authenticated, service_role;
grant execute on function app.can_edit_tenant(text) to authenticated, service_role;

-- Funções futuras em public também nascem fechadas.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema app revoke execute on functions from public;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS dos tenants e membros: o usuário vê os tenants de que participa e os colegas
-- deles. Criar tenant e convidar membro passa pelo servidor (service_role).
-- ─────────────────────────────────────────────────────────────────────────────
alter table tenants        enable row level security;
alter table tenant_members enable row level security;

drop policy if exists tenants_select on tenants;
create policy tenants_select on tenants for select to authenticated
  using (app.is_tenant_member(id));

drop policy if exists tenant_members_select on tenant_members;
create policy tenant_members_select on tenant_members for select to authenticated
  using (app.is_tenant_member(tenant_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- POLICIES por tenant nas tabelas de dados, e FK de tenant_id para tenants.
-- A FK entra NOT VALID: vale para toda linha nova sem varrer as antigas.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  -- o usuário edita (owner/admin/editor)
  editorial text[] := array[
    'queue_items', 'pending_approvals', 'scheduled_posts', 'publish_slots',
    'style_rules', 'feedback', 'campaigns', 'briefs', 'assets', 'publishing_controls',
    'engagements', 'engage_targets'
  ];
  -- só jobs escrevem; o usuário lê
  read_only text[] := array[
    'posts', 'post_variants', 'metrics_snapshots', 'post_events', 'rejected_posts',
    'prompt_versions', 'bandit_snapshots', 'funnel_daily'
  ];
begin
  foreach t in array editorial || read_only loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format(
      'create policy tenant_select on public.%I for select to authenticated using (app.is_tenant_member(tenant_id))', t);

    if not exists (
      select 1 from pg_constraint where conname = t || '_tenant_fk' and conrelid = format('public.%I', t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (tenant_id) references public.tenants(id) not valid',
        t, t || '_tenant_fk');
    end if;

    execute format('revoke all on public.%I from anon', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;

  foreach t in array editorial loop
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format(
      'create policy tenant_insert on public.%I for insert to authenticated with check (app.can_edit_tenant(tenant_id))', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format(
      'create policy tenant_update on public.%I for update to authenticated using (app.can_edit_tenant(tenant_id)) with check (app.can_edit_tenant(tenant_id))', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format(
      'create policy tenant_delete on public.%I for delete to authenticated using (app.can_edit_tenant(tenant_id))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  foreach t in array read_only loop
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

revoke all on tenants, tenant_members from anon;
grant select on tenants, tenant_members to authenticated;
grant all on tenants, tenant_members to service_role;

-- Projeto Supabase novo não concede mais as tabelas antigas (0001 a 0005) à service_role
-- por default. O banco de produção vai ser recriado; sem isto o backend toma 403.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
