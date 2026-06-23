-- 0005_style_rules.sql — regras de estilo aprendidas com as edições humanas
-- (reflection, insight nº 1). Geradas por src/reflect.js a partir do diff entre
-- a legenda sugerida (composeCaption(variation)) e a caption_final editada no
-- cockpit. Injetadas no system prompt das gerações futuras (src/generate.js).
--
-- Aditivo e seguro. Escopo por tenant. RLS: mesmo padrão (service_role bypassa;
-- anon/authenticated revogados via default privileges de 0001).

create table if not exists style_rules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null default 'pilar',
  channel     text,                      -- null = vale pra todos os canais
  rule        text not null,             -- regra imperativa curta
  evidence    jsonb,                     -- de quantas/quais edições saiu
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists style_rules_tenant_idx on style_rules (tenant_id, active, created_at desc);

alter table style_rules enable row level security;
revoke all on style_rules from anon, authenticated;
