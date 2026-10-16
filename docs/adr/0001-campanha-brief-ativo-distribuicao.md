# ADR 0001: campanha, brief, ativo e distribuição

- **Status:** proposto
- **Data:** 2026-10-15
- **Spec que depende:** [SPEC 001](../specs/001-sistema-de-campanha-fase-a.md)

## Contexto

A unidade do sistema hoje é um post: `index.js` escolhe pilar e ângulo por canal, gera 3
variações, e `scheduled_posts` guarda uma imagem ou slides. O plano de presença social
(`docs/plano-presenca-social.md`) pede outra unidade: uma semana de campanha com várias
peças, uma ideia central desdobrada em formatos diferentes (texto, foto-pergunta,
carrossel, carrossel em PDF, Reels, story, thread), cada peça publicada em um ou mais
canais e medida até o cadastro ativado na Pilar (ADR 0060 do repo da Pilar).

Sem um modelo que separe ideia, peça e publicação:

- cada canal sorteia um ângulo diferente e a campanha perde coerência;
- vídeo e documento não têm onde morar em `scheduled_posts`;
- o UTM não tem um id estável para devolver o funil por peça.

## Decisão

Quatro níveis, todos com `tenant_id`:

| Nível | Tabela | O que é | Exemplo |
| --- | --- | --- | --- |
| Campanha | `campaigns` (nova) | objetivo, KPI, fase, janela, mix de formatos | "Quanto custa um projeto", 16/11 a 20/12, KPI cadastro ativado |
| Brief | `briefs` (nova) | uma ideia central da semana: pilar, ângulo, evidência, CTA | "Revisão 3 não cobrada custa 12% da margem" |
| Ativo | `assets` (nova) | uma peça renderizada de um brief, com tipo e mídia | carrossel de 7 slides; Reels de 22 s |
| Distribuição | `scheduled_posts` (estendida) | um ativo num canal, num horário, com UTM | o carrossel no IG ter 12h; o mesmo como PDF no LinkedIn qua 8h |

- `scheduled_posts` continua sendo a fila do scheduler e ganha `asset_id`, `brief_id`,
  `campaign_id`, `media_kind`, `video_url`, `document_url` e `utm`. Não nasce tabela
  `distributions`: a máquina de estados, o lock e o retry que já funcionam ficam como
  estão.
- `posts` continua sendo o histórico do que foi publicado e ganha `scheduled_post_id`,
  para ligar métrica e funil à distribuição.
- O `utm_content` é o id curto da distribuição. Ele é a chave que a Pilar devolve em
  `ops-export-funil`.
- `campaigns.yaml` continua sendo onde eu escrevo campanha nesta fase; um sync faz upsert
  por `slug` a cada execução. A tabela vira fonte única quando a plataforma ganhar a tela
  de campanhas.
- Migração aditiva: colunas novas são nulas, e o fluxo atual (um post por canal, sem
  brief) continua funcionando enquanto o Planner não existe.

## Consequências

- **Ganha:** uma ideia vira N peças coerentes; o bandit pode aprender por formato, por
  campanha e por cadastro ativado; vídeo e PDF passam a ter caminho até a publicação.
- **Custa:** três tabelas novas, uma migration, os tipos da plataforma e a inbox passam a
  agrupar por brief. O `index.js` atual precisa de um modo brief, além do modo pilar.
- **Risco:** atribuição por peça no Instagram é fraca (link no post não é clicável). A
  atribuição fina vale para LinkedIn, X e story com link; no feed do Instagram mede-se
  por campanha, pelo link da bio.
- **Reverter:** dropar as colunas novas e as três tabelas; nada do fluxo atual depende
  delas.
