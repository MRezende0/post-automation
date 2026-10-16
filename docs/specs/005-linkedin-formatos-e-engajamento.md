# SPEC 005: LinkedIn com formatos alternados e engajamento pela API

- **Status:** proposta
- **Data:** 2026-10-16
- **Depende de:** [SPEC 003](003-ideia-reaproveitamento-e-feedback.md) (ideia por rodada,
  feedback, regras), [ADR 0002](../adr/0002-plataforma-como-produto-proprio.md),
  `platform/src/lib/channel-capabilities.json`, `docs/plano-presenca-social.md` (LinkedIn
  pessoal é o canal de maior alcance B2B)

## Problema

1. **Não existe post só texto.** A aprovação sempre anexa uma arte (`art ?? images[0]`), e a
   geração renderiza card para toda variação do LinkedIn. Texto de founder com card genérico
   rende menos.
2. **O formato não alterna.** O bandit de formato só roda no Instagram. No LinkedIn o modelo
   escolhe sozinho e tende ao mesmo formato.
3. **Vídeo não publica.** A API de vídeos existe e a matriz marca `video` como `planned`.
4. **Interação fora da plataforma.** `engage.js` rascunha comentários pelo terminal, manda para
   o Telegram, não usa a voz aprendida, não publica e não registra nada.

## Resultado esperado

- O LinkedIn alterna texto puro, texto com imagem, carrossel em PDF e vídeo (quando houver
  vídeo), e eu escolho "Sem imagem" na aprovação de qualquer post.
- Numa área "Engajamento" da plataforma eu colo o link e o texto de um post (ou de um comentário
  no meu post), escolho uma de 3 sugestões de comentário na minha voz, edito e publico pela API.
  Cada comentário fica registrado, com a meta da semana.

**Fora de escopo:** página da empresa (sem conta ainda; última fase), enquete (a API não foi
validada para perfil pessoal; segue manual), leitura do feed de terceiros (a API não oferece),
métricas do perfil pessoal (só por CSV).

## Decisões

1. **Comentário publicado pela API, com aprovação humana em cada um.** Decisão do Matheus, ciente
   de que o contrato do LinkedIn proíbe engajamento automatizado. Mitigação: nada é publicado sem
   clique, limite diário (padrão 20) e intervalo mínimo de 60 s entre comentários, e o texto
   sempre passa pela tela de edição.
2. **Fallback "Copiar e abrir o post"** quando a API recusar (403 por permissão do app, 400 por
   URN de activity não aceita, 429 por limite). O comentário fica registrado como `copiado`.
3. **Formato do LinkedIn por rodízio, depois bandit.** Sem métrica do perfil pessoal pela API, o
   bandit não tem nota; até ter (CSV ou SPEC 004), o formato menos usado nas últimas 8 rodadas
   vence. Vídeo só entra no sorteio quando houver vídeo pronto.
4. **A plataforma chama o Gemini direto** (REST, sem SDK) para rascunhar comentários: o rascunho é
   interativo e não pode esperar o cron.

## Requisitos

### R1. Formatos do LinkedIn

1. `tenant.taxonomy.formatsByChannel.linkedin = ['text', 'single', 'carousel']`;
   `chooseNextFormat` aceita `{ channel, rotate: true }` e, sem bandit, devolve o formato menos
   usado na janela daquele canal. O Instagram segue como hoje.
2. `generatePost` passa `targetFormat` também no LinkedIn.
3. Variação `format: 'text'` não renderiza imagem na geração.
4. Aprovação (tela por rede e tela da ideia): opção "Sem imagem" ao lado das artes; é o padrão
   quando a variação é `text`. Aprovar sem imagem grava `image_url = null` e `media_kind = text`.

### R2. Vídeo no LinkedIn

1. `channels/linkedin.ts` ganha `uploadVideoFromUrl` (Videos API: `initializeUpload`, upload em
   partes com ETag, `finalizeUpload`) e `publishText` aceita vídeo.
2. `publish.ts`: LinkedIn com `video_url` publica vídeo; a matriz passa `video` para `auto`.

### R3. Engajamento

1. Migration `0011_engagements.sql`: `engagements` (`tenant_id`, `kind` comentario | resposta,
   `target_url`, `target_urn`, `parent_comment_urn`, `target_author`, `target_text`, `options`
   jsonb, `comment_text`, `status` rascunho | publicado | copiado | falhou, `error`,
   `comment_urn`, `created_at`, `posted_at`) e `engage_targets` (`name`, `profile_url`, `note`,
   `active`). RLS ligada, service role.
2. `parseLinkedinTarget(url)`: extrai `urn:li:activity|share|ugcPost` de link de post e o
   `commentUrn` de link de comentário (parâmetro `commentUrn`). Link inválido é recusado com o
   motivo.
3. Rascunho: 3 opções com persona do tenant, regras ativas de texto e tom, e feedback recente.
   Comentário: acrescenta uma experiência ou ideia concreta, 1 a 3 frases, sem citar a Pilar.
   Resposta: responde à pessoa, curta, convida a continuar a conversa.
4. Publicar: `POST /rest/socialActions/{alvo}/comments` com `actor` = perfil, `object` = post e
   `parentComment` na resposta. Respeita o limite diário e o intervalo; recusa com mensagem clara.
5. Tela `/engage`: formulário (link, texto, autor), opções editáveis, "Comentar no LinkedIn" e
   "Copiar e abrir o post"; contador da semana contra a meta (`tenant.engage.weeklyGoal`, padrão
   15); histórico; contas-alvo com atalho para a atividade.
6. `engage.js` (terminal) passa a usar o mesmo prompt.

## Critérios de aceite

- Rodada com LinkedIn alterna o formato pedido ao modelo entre texto, imagem e carrossel.
- Aprovar com "Sem imagem" publica só texto.
- `parseLinkedinTarget` aceita os 3 formatos de link de post e o de comentário; recusa link de
  perfil.
- Comentário publicado grava `publicado` com o `comment_urn`; 403/400/429 gravam `falhou` e a tela
  oferece copiar e abrir.
- Testes: rodízio de formato, parser de link, limite diário, montagem do prompt, upload de vídeo
  com fetch simulado. `tsc --noEmit` limpo; migrations passam no CI.

## Entregas

1. **PR A:** R1 e R2.
2. **PR B:** R3.
