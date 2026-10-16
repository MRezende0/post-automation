-- 0011_engagements.sql: engajamento no LinkedIn (SPEC 005 R3). Cada comentário ou resposta
-- rascunhado na plataforma, com as opções sugeridas, o texto final e o que aconteceu ao
-- publicar. Contas-alvo do ICP pra acompanhar. Aditivo e idempotente.

create table if not exists engagements (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text not null default 'pilar',
  kind                text not null default 'comentario' check (kind in ('comentario', 'resposta')),
  target_url          text not null,
  target_urn          text not null,          -- urn:li:activity|share|ugcPost do post
  parent_comment_urn  text,                   -- resposta: comentário ao qual responde
  target_author       text,
  target_text         text not null,
  options             jsonb,                  -- sugestões do modelo
  comment_text        text,                   -- o que foi publicado ou copiado
  status              text not null default 'rascunho'
                      check (status in ('rascunho', 'publicado', 'copiado', 'falhou')),
  error               text,
  comment_urn         text,
  created_at          timestamptz not null default now(),
  posted_at           timestamptz
);
create index if not exists engagements_tenant_recent_idx on engagements (tenant_id, created_at desc);
create index if not exists engagements_posted_idx on engagements (tenant_id, status, posted_at desc);

create table if not exists engage_targets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null default 'pilar',
  name         text not null,
  profile_url  text not null,
  note         text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists engage_targets_tenant_idx on engage_targets (tenant_id, active);

alter table engagements    enable row level security;
alter table engage_targets enable row level security;
revoke all on engagements, engage_targets from anon, authenticated;
grant all on engagements, engage_targets to service_role;
