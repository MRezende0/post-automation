-- rls_test.sql: prova o isolamento por tenant contra um Postgres de verdade (gate 4 da
-- esteira). Roda como o papel que o app usa (authenticated, com o JWT simulado), não
-- como superuser: superuser ignora RLS e o teste passaria por acidente.
--
-- Uso: psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/ci/bootstrap.sql (antes das migrations)
--      psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/ci/rls_test.sql
-- Tudo roda numa transação desfeita no fim: o banco sai como entrou.

\set ON_ERROR_STOP 1
begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogo: regras que valem para toda tabela, inclusive as que ainda vão nascer.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  -- toda tabela de public tem RLS ligado
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception 'tabela % sem RLS', r.relname;
  end loop;

  -- toda tabela com tenant_id tem policy de leitura para authenticated
  for r in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (
        select 1 from pg_policy p
        where p.polrelid = c.oid and p.polcmd in ('r', '*') and 'authenticated'::regrole = any (p.polroles)
      )
  loop
    raise exception 'tabela % tem tenant_id mas não tem policy de leitura', r.relname;
  end loop;

  -- nenhum tenant_id tem default: quem insere informa o tenant (0013)
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'tenant_id' and column_default is not null
  loop
    raise exception 'tenant_id de % tem default; informe o tenant em todo insert', r.table_name;
  end loop;

  -- anon não toca em tabela nenhuma
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))
  loop
    raise exception 'anon tem privilégio em %', r.relname;
  end loop;

  -- nenhuma função SECURITY DEFINER de public/app é executável por anon
  for r in
    select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app') and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    raise exception 'função SECURITY DEFINER %.% executável por anon', r.nspname, r.proname;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cenário: dois tenants, três usuários.
--   A: editor da pilar   B: viewer da acme   C: logado sem tenant nenhum
-- ─────────────────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test');
insert into tenants (id, name) values ('acme', 'Acme') on conflict (id) do nothing;
-- tenant novo nasce pausado (trigger da 0013)
do $$
begin
  if not exists (select 1 from publishing_controls where tenant_id = 'acme' and paused) then
    raise exception 'tenant novo deveria nascer pausado';
  end if;
end $$;
insert into tenant_members (tenant_id, user_id, role) values
  ('pilar', '00000000-0000-0000-0000-00000000000a', 'editor'),
  ('acme',  '00000000-0000-0000-0000-00000000000b', 'viewer');
insert into feedback (tenant_id, aspect, note) values ('pilar', 'tom', 'rls-pilar'), ('acme', 'tom', 'rls-acme');
insert into posts (tenant_id, pillar, channel) values ('pilar', 'dica', 'instagram'), ('acme', 'dica', 'instagram');
insert into notifications (tenant_id, kind, title) values ('pilar', 'rls', 'rls-pilar'), ('acme', 'rls', 'rls-acme');

-- ── A: editor da pilar ───────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
do $$
declare n int;
begin
  select count(*) into n from feedback where note like 'rls-%';
  if n <> 1 then raise exception 'A deveria ver 1 feedback, viu %', n; end if;
  if exists (select 1 from feedback where tenant_id <> 'pilar') then raise exception 'A viu feedback de outro tenant'; end if;
  if exists (select 1 from posts where tenant_id <> 'pilar') then raise exception 'A viu post de outro tenant'; end if;
  select count(*) into n from tenants;
  if n <> 1 then raise exception 'A deveria ver só o próprio tenant, viu %', n; end if;

  insert into feedback (tenant_id, aspect, note) values ('pilar', 'tom', 'rls-a-ok');

  begin
    insert into feedback (tenant_id, aspect, note) values ('acme', 'tom', 'rls-a-invade');
    raise exception 'A gravou feedback na acme';
  exception when insufficient_privilege then null;
  end;

  update feedback set note = 'rls-a-alterou' where tenant_id = 'acme';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A alterou % linha(s) da acme', n; end if;

  begin
    insert into posts (tenant_id, pillar, channel) values ('pilar', 'dica', 'instagram');
    raise exception 'A gravou em posts (só jobs gravam)';
  exception when insufficient_privilege then null;
  end;

  select count(*) into n from notifications where kind = 'rls';
  if n <> 1 then raise exception 'A deveria ver 1 aviso, viu %', n; end if;
  if exists (select 1 from notifications where tenant_id <> 'pilar') then raise exception 'A viu aviso de outro tenant'; end if;

  begin
    insert into notifications (tenant_id, kind, title) values ('pilar', 'rls', 'rls-a-forja');
    raise exception 'A gravou aviso (só jobs gravam)';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── B: viewer da acme ────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
do $$
declare n int;
begin
  select count(*) into n from feedback where note like 'rls-%';
  if n <> 1 then raise exception 'B deveria ver 1 feedback, viu %', n; end if;
  if exists (select 1 from feedback where tenant_id <> 'acme') then raise exception 'B viu feedback de outro tenant'; end if;

  begin
    insert into feedback (tenant_id, aspect, note) values ('acme', 'tom', 'rls-b-viewer');
    raise exception 'viewer B conseguiu gravar';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── C: logado sem tenant (cadastro aberto não dá acesso a nada) ──────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
do $$
begin
  if exists (select 1 from feedback) then raise exception 'C sem tenant viu feedback'; end if;
  if exists (select 1 from notifications) then raise exception 'C sem tenant viu aviso'; end if;
  if exists (select 1 from tenants) then raise exception 'C sem tenant viu tenant'; end if;
  if exists (select 1 from tenant_members) then raise exception 'C sem tenant viu membros'; end if;
end $$;

-- ── anon: nem chega na tabela ────────────────────────────────────────────────
reset role;
set role anon;
do $$
begin
  begin
    perform 1 from feedback;
    raise exception 'anon leu feedback';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
rollback;
\echo 'RLS: isolamento por tenant ok'
