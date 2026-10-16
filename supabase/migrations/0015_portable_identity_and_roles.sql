-- 0015_portable_identity_and_roles.sql: banco portável e três papéis de conta (SPEC 008).
--
-- 1. Identidade sem o Supabase Auth. A pessoa mora em `users` (nossa), e o usuário da
--    requisição vem de app.current_user_id(): primeiro `app.user_id`, que o nosso servidor
--    define por transação, depois o `sub` do JWT que o PostgREST do Supabase põe em
--    request.jwt.claims. Assim as policies valem no Supabase e num Postgres puro (Cloud SQL).
--    Nenhuma policy, função ou FK ativa depende mais do schema `auth`.
-- 2. Três papéis: admin (tudo da conta), creator (produz; aprova só se a conta liberar) e
--    viewer (lê, dá parecer e feedback). `owner` vira admin e `editor` vira creator.
--    A matriz mora em `role_permissions` e as policies perguntam a app.can().
-- 3. Toda conta com administrador mantém pelo menos um: o último não sai nem é rebaixado.
--
-- Reaplicável (o CI roda duas vezes).
--
-- allow-destructive: o único `delete` limpa `role_permissions`, a matriz que esta mesma migration
-- semeia logo em seguida. Nenhum dado de cliente é apagado. Os papéis de API (anon, authenticated, service_role)
-- continuam vindo do Supabase ou de supabase/ci/bootstrap.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Identidade
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email = lower(email) and position('@' in email) > 1),
  idp_uid     text unique,
  created_at  timestamptz not null default now()
);
comment on column users.idp_uid is 'id da pessoa no provedor de login (Identity Platform ou Supabase Auth)';

-- Membros que já existem no Supabase Auth ganham a linha em `users` com o mesmo id.
do $$
begin
  if to_regclass('auth.users') is not null then
    insert into public.users (id, email, idp_uid)
    select u.id, coalesce(lower(u.email), u.id::text || '@sem-email.invalid'), u.id::text
    from auth.users u
    where exists (select 1 from public.tenant_members m where m.user_id = u.id)
    on conflict (id) do nothing;
  end if;
end $$;

alter table tenant_members drop constraint if exists tenant_members_user_id_fkey;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_members_user_fk') then
    alter table tenant_members add constraint tenant_members_user_fk
      foreign key (user_id) references users(id) on delete cascade;
  end if;
end $$;

create or replace function app.current_user_id()
returns uuid
language sql stable set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.user_id', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Papéis
-- ─────────────────────────────────────────────────────────────────────────────
alter table tenant_members drop constraint if exists tenant_members_role_check;
update tenant_members set role = case role when 'owner' then 'admin' when 'editor' then 'creator' else role end
  where role in ('owner', 'editor');
alter table tenant_members add constraint tenant_members_role_check check (role in ('admin', 'creator', 'viewer'));
alter table tenant_members alter column role set default 'creator';

alter table tenants add column if not exists creator_can_approve boolean not null default false;

create table if not exists role_permissions (
  role        text not null check (role in ('admin', 'creator', 'viewer')),
  permission  text not null,
  primary key (role, permission)
);

-- A matriz inteira é reescrita a cada aplicação: a migration é a fonte.
delete from role_permissions;
insert into role_permissions (role, permission)
select r.role, p.permission
from (values
  ('content.view',      array['admin', 'creator', 'viewer']),
  ('content.feedback',  array['admin', 'creator', 'viewer']),
  ('content.create',    array['admin', 'creator']),
  ('content.edit',      array['admin', 'creator']),
  ('review.request',    array['admin', 'creator']),
  ('content.approve',   array['admin']),
  ('publishing.manage', array['admin']),
  ('channels.manage',   array['admin']),
  ('brand.manage',      array['admin']),
  ('team.manage',       array['admin']),
  ('billing.manage',    array['admin']),
  ('audit.view',        array['admin']),
  ('account.export',    array['admin']),
  ('account.delete',    array['admin'])
) as p(permission, roles)
cross join lateral unnest(p.roles) as r(role);

alter table role_permissions enable row level security;
drop policy if exists role_permissions_select on role_permissions;
create policy role_permissions_select on role_permissions for select to authenticated using (true);
revoke all on role_permissions, users from anon, authenticated;
grant select on role_permissions to authenticated;
grant all on role_permissions, users to service_role;

-- Quem pode o quê numa conta. O criador aprova só com `creator_can_approve` ligado.
create or replace function app.can(p_tenant text, p_permission text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members m
    join public.role_permissions rp on rp.role = m.role and rp.permission = p_permission
    where m.tenant_id = p_tenant and m.user_id = app.current_user_id()
  ) or (
    p_permission = 'content.approve' and exists (
      select 1
      from public.tenant_members m
      join public.tenants t on t.id = m.tenant_id
      where m.tenant_id = p_tenant and m.user_id = app.current_user_id()
        and m.role = 'creator' and t.creator_can_approve
    )
  );
$$;

create or replace function app.is_tenant_member(p_tenant text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = p_tenant and m.user_id = app.current_user_id()
  );
$$;

-- Mantida para as policies antigas: editar conteúdo.
create or replace function app.can_edit_tenant(p_tenant text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.can(p_tenant, 'content.edit');
$$;

revoke execute on function app.current_user_id() from public;
revoke execute on function app.can(text, text) from public;
grant execute on function app.current_user_id() to authenticated, service_role;
grant execute on function app.can(text, text) to authenticated, service_role;

-- A pessoa vê a si mesma e os colegas das contas em que está.
alter table users enable row level security;
drop policy if exists users_select on users;
create policy users_select on users for select to authenticated using (
  id = app.current_user_id()
  or exists (
    select 1 from tenant_members mine
    join tenant_members other on other.tenant_id = mine.tenant_id
    where mine.user_id = app.current_user_id() and other.user_id = users.id
  )
);
grant select on users to authenticated;

-- Escrita por permissão, tabela a tabela. As demais tabelas editoriais seguem com
-- app.can_edit_tenant (content.edit) da 0012.
do $$
declare r record;
begin
  for r in
    select * from (values
      ('scheduled_posts',     'content.approve'),
      ('publishing_controls', 'publishing.manage'),
      ('publish_slots',       'publishing.manage'),
      ('style_rules',         'brand.manage')
    ) as t(tbl, perm)
  loop
    execute format('drop policy if exists tenant_insert on public.%I', r.tbl);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (app.can(tenant_id, %L))', r.tbl, r.perm);
    execute format('drop policy if exists tenant_update on public.%I', r.tbl);
    execute format('create policy tenant_update on public.%I for update to authenticated using (app.can(tenant_id, %L)) with check (app.can(tenant_id, %L))', r.tbl, r.perm, r.perm);
    execute format('drop policy if exists tenant_delete on public.%I', r.tbl);
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (app.can(tenant_id, %L))', r.tbl, r.perm);
  end loop;
end $$;

-- Feedback e parecer: qualquer papel dá; editar ou apagar continua com quem edita conteúdo.
drop policy if exists tenant_insert on feedback;
create policy tenant_insert on feedback for insert to authenticated with check (app.can(tenant_id, 'content.feedback'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Pelo menos um administrador
-- ─────────────────────────────────────────────────────────────────────────────
-- Vale para toda remoção ou rebaixamento direto. Fica de fora a cascata (conta ou pessoa
-- sendo apagada), que chega aqui com pg_trigger_depth() > 1.
create or replace function app.keep_one_admin()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.tenant_id <> old.tenant_id)
     and not exists (
       select 1 from public.tenant_members m
       where m.tenant_id = old.tenant_id and m.role = 'admin' and m.user_id <> old.user_id
     ) then
    raise exception 'a conta % precisa de pelo menos um administrador', old.tenant_id
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function app.keep_one_admin() from public;

drop trigger if exists tenant_members_keep_admin on tenant_members;
create trigger tenant_members_keep_admin before update or delete on tenant_members
  for each row execute function app.keep_one_admin();
