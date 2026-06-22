-- 0004_drop_legacy_pending_index.sql — remove o índice único legado de pending.
--
-- APLICAR SÓ DEPOIS de:
--   1. a 0003 estar aplicada, E
--   2. o código novo (onConflict:'tenant_id,channel' em src/utils/queue.js) estar
--      em produção e validado por um ciclo.
-- E ANTES de cadastrar um 2º tenant: UNIQUE(channel) impede dois tenants de terem
-- o mesmo canal (ex: ambos 'instagram'). Até lá o índice legado é inofensivo
-- (só existe a Pilar, com um pending por canal).

drop index if exists pending_channel_idx;
