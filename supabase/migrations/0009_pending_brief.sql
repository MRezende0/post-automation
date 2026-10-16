-- 0009_pending_brief.sql: a pendência sabe de que ideia veio (SPEC 003 R1). Redes da
-- mesma rodada compartilham o brief_id; a aprovação leva o vínculo pra scheduled_posts
-- (coluna criada na 0006). Aditivo e seguro.

alter table pending_approvals add column if not exists brief_id uuid references briefs(id) on delete set null;
create index if not exists pending_brief_idx on pending_approvals (brief_id);
