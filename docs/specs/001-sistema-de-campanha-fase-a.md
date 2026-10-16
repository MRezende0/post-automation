# SPEC 001: sistema de campanha, fase A

- **Status:** proposta
- **Data:** 2026-10-15
- **Prazo:** fase A do plano, 20/10 a 15/11/2026
- **Depende de:** [ADR 0001](../adr/0001-campanha-brief-ativo-distribuicao.md), ADR 0060 e
  SPEC 126 do repo da Pilar, `docs/plano-presenca-social.md`

## Problema

O repo gera bem um post por vez, mas o plano de lançamento pede campanha: uma ideia
desdobrada em vários formatos e canais, com vídeo, carrossel em PDF e foto-pergunta,
medida até o cadastro ativado. Hoje não há UTM, não há onde guardar vídeo ou PDF, cada
canal sorteia um ângulo diferente e a aprovação é post a post.

## Resultado esperado

Ao fim da fase A, eu abro a plataforma na segunda, vejo a semana agrupada por ideia, aprovo
em lote peças de 4 formatos (texto, foto-pergunta, carrossel, Reels) para Instagram e
LinkedIn, e cada link publicado carrega um UTM que a Pilar consegue devolver no funil.

**Fora de escopo (onda 2):** o Planner semanal automático, coletores de anúncios, Search
Console e PageSpeed, o envio para `ops-ingest`, o prêmio do bandit por cadastro ativado e
o publish real do X.

## Requisitos

### R1. UTM em todo link

1. `src/utils/utm.js` monta o link a partir da distribuição:
   `utm_source` (instagram, linkedin, x, youtube, whatsapp, email), `utm_medium`
   (organico, bio, story, dm), `utm_campaign` (slug da campanha ou `sempre-on`),
   `utm_content` (id curto da distribuição: `d` + 8 caracteres do uuid).
2. Destino padrão: `https://pilarsoft.com.br` (configurável no tenant).
3. Política de link por canal, no tenant:
   - LinkedIn: link no primeiro comentário, publicado logo depois do post;
   - X: link na resposta ao primeiro tweet;
   - Instagram feed: sem link no texto; CTA "link na bio"; a bio usa o UTM da campanha
     ativa;
   - story: sticker de link com o UTM da distribuição.
4. O UTM fica gravado em `scheduled_posts.utm` e em `posts`.

### R2. Modelo de dados (migration `0006_campaign_model.sql`, aditiva)

1. `campaigns`: `id, tenant_id, slug unique por tenant, name, objective, kpi, phase,
   start_date, end_date, context, formats_mix jsonb, budget_brl, status`.
2. `briefs`: `id, tenant_id, campaign_id, week_of, pillar, angle, idea, evidence, cta,
   status (planned | producing | ready | approved | dropped)`.
3. `assets`: `id, tenant_id, brief_id, kind (text | image | carousel | document | video |
   thread | story), status (rendering | ready | failed), caption, hashtags, media jsonb
   ({ image, slides[], pdf, video, cover, duration_s }), script jsonb, source (generated |
   human_cut | manual), generation jsonb`.
4. `scheduled_posts` ganha `asset_id, brief_id, campaign_id, media_kind, video_url,
   document_url, utm jsonb`. `posts` ganha `scheduled_post_id`.
5. RLS ligada, sem policy pública, acesso por service role (igual às outras tabelas).
6. Sync de `content/campaigns.yaml` para `campaigns` (upsert por slug) no início do
   `index.js`.

### R3. Modo brief na geração

1. `src/brief.js` gera um brief a partir da campanha ativa (ou da rotação de pilares) e
   desdobra em ativos pelo `formats_mix` da campanha (padrão da fase A: texto LinkedIn,
   foto-pergunta ou carrossel no IG, roteiro de Reels).
2. Todos os ativos de um brief usam o mesmo pilar, ângulo e evidência. Crítico, judge,
   polish e guardrails rodam por ativo, como hoje.
3. O modo atual (um post por canal) continua disponível por flag `GENERATION_MODE=post`.

### R4. Foto-pergunta

1. Template `templates/instagram/foto-pergunta.html`: traço de croqui em ink sobre paper,
   um elemento em verde `#A4EC86`, pergunta de até 12 palavras, logo e handle.
2. Biblioteca `assets/croquis/` com 20 a 30 SVGs (prancha, cota, carimbo, régua, corte,
   planta, escalímetro). O modelo escolhe peça + pergunta; o guardrail recusa pergunta
   com mais de 12 palavras.

### R5. Carrossel em PDF no LinkedIn

1. Os slides renderizados viram um PDF (Puppeteer `page.pdf` com um slide por página).
2. Publicação pelo fluxo `/rest/documents?action=initializeUpload` + `/rest/posts` com
   `content.media` do documento, no Node e no scheduler da plataforma.
3. Substitui o `throw` atual de `linkedin.publishCarousel`.

### R6. Vídeo até a aprovação

1. A fábrica de vídeo segue `docs/video/prompt-fabrica-de-video.md` (piloto: `reel-tela` e
   `reel-cinetico`).
2. O roteiro do `reel.js` vira um ativo `video` com `status = rendering`; o render grava
   `media.video`, `media.cover` e `duration_s` e passa para `ready`.
3. O scheduler da plataforma ganha `publishReel` (Instagram `media_type=REELS`, espera o
   container ficar `FINISHED` antes de publicar).
4. A inbox toca o vídeo e mostra a capa.

### R7. Inbox por semana

1. Nova tela `/semana/[data]` lista os briefs da semana com seus ativos lado a lado,
   por canal e horário sugerido.
2. Ações por ativo: aprovar, editar legenda, trocar arte, descartar com motivo. Ação em
   lote: aprovar o brief inteiro (todos os ativos `ready`), que cria as distribuições nos
   próximos slots livres de cada canal.
3. A `/inbox` atual continua para o modo post.

## Critérios de aceite

- [ ] Dado um ativo aprovado para o LinkedIn, quando publicado, então o primeiro
      comentário contém o link com `utm_content` igual ao id curto da distribuição.
- [ ] Dado `campaigns.yaml` com uma campanha nova, quando o `index.js` roda, então existe
      uma linha em `campaigns` com o mesmo slug e as datas certas (sem regressão do bug de
      data do js-yaml).
- [ ] Dada a campanha "Quanto custa um projeto" ativa, quando o modo brief gera a semana,
      então todos os ativos do brief têm o mesmo pilar, ângulo e evidência.
- [ ] Dado um carrossel aprovado para o LinkedIn, quando publicado, então sai como
      documento com um slide por página.
- [ ] Dado um roteiro de Reels, quando o render termina, então a inbox mostra o vídeo e
      a capa, e aprovar agenda a publicação como Reels.
- [ ] Dado um brief com 3 ativos prontos, quando eu aprovo o brief, então nascem 3
      distribuições nos próximos slots livres de cada canal.
- [ ] Dada a migration 0006 aplicada, o fluxo atual (modo post) continua publicando sem
      mudança.

## Verificação

- Vitest para `utm.js`, sync de campanhas, desdobramento do brief, guardrail da pergunta
  e montagem do PDF.
- Migration aplicada num Supabase local (portas deslocadas, como na fase 5) e um ciclo
  completo exercitado: gerar brief, aprovar em lote, publish-due com credencial removida
  (falha controlada, sem postar no perfil real).
- `next build` limpo na plataforma.
- Um post real de teste no LinkedIn com documento e um Reels real no Instagram antes de
  ligar na cadência.

## Telemetria

- `post_events`: `brief_created`, `asset_ready`, `asset_failed`, `brief_approved`,
  `distribution_scheduled`.
- Taxa de aprovação sem edição por formato (alimenta o reflection e a revisão de
  autonomia).
- Tempo de render por tipo de vídeo.

## Riscos

- **LinkedIn pessoal sem métrica por API.** Publicar e comentar funcionam com
  `w_member_social`; impressões do perfil pessoal não vêm pela API atual (`getInsights`
  devolve `impressions: null`). Mitigação: CSV semanal do LinkedIn até a aprovação da
  Community Management API.
- **Enquete e caixinha de story não existem na API do Instagram.** Ficam como tarefa
  manual com o texto pronto na inbox.
- **Atribuição fraca no feed do Instagram** (ADR 0001). Mede-se por campanha via bio.
- **Render de vídeo no GitHub Actions** pode estourar tempo ou precisar de Chromium com
  fontes. Mitigação: o piloto roda local; se o render no CI passar de 10 minutos, avaliar
  render em nuvem do HyperFrames.

## Ordem de implementação

1. R1 + R2 (base de tudo; um PR).
2. R4 e R5 (formatos estáticos; um PR cada).
3. R3 + R7 (modo brief e inbox semanal; um PR).
4. R6 (depende do piloto da fábrica de vídeo).
