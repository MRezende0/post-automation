-- 0007_feedback.sql: "o que não gostei" (SPEC 003 R4/R5). Feedback estruturado por
-- aspecto, registrado na aprovação, na rejeição e no histórico. Entra cru no prompt por
-- 14 dias (src/utils/feedback.js) e o reflect semanal consolida em style_rules.
--
-- Aditivo e seguro. Escopo por tenant. RLS: mesmo padrão (service_role, sem policy pública).

create table if not exists feedback (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          text not null default 'pilar',
  -- a que se refere (todos opcionais: feedback pode ser geral)
  brief_id           uuid references briefs(id) on delete set null,
  pending_id         text,
  scheduled_post_id  uuid references scheduled_posts(id) on delete set null,
  post_id            uuid references posts(id) on delete set null,
  channel            text,                   -- null = vale pra todas as redes
  aspect             text not null check (aspect in ('texto', 'visual', 'tom', 'tema', 'formato', 'cta')),
  sentiment          text not null default 'negativo' check (sentiment in ('negativo', 'positivo')),
  note               text not null check (length(trim(note)) > 0),
  excerpt            text,                   -- gancho do post, contexto pro reflect
  created_at         timestamptz not null default now()
);
create index if not exists feedback_tenant_recent_idx on feedback (tenant_id, created_at desc);

-- Regras ganham aspecto (visual vai pro prompt de imagem, o resto pro de texto) e origem.
-- source: edicao | feedback (derivadas pelo reflect, substituídas a cada rodada) | manual
-- (criada ou editada na plataforma, o reflect nunca desliga).
alter table style_rules add column if not exists aspect text;
alter table style_rules add column if not exists source text not null default 'edicao';
alter table style_rules add column if not exists updated_at timestamptz not null default now();

drop trigger if exists style_rules_touch on style_rules;
create trigger style_rules_touch before update on style_rules for each row execute function touch_updated_at();

alter table feedback enable row level security;
revoke all on feedback from anon, authenticated;
grant all on feedback to service_role;
