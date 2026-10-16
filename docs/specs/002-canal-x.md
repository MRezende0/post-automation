# SPEC 002: publicação real no X

- **Status:** proposta
- **Data:** 2026-10-15
- **Depende de:** [SPEC 001](001-sistema-de-campanha-fase-a.md) R1 (UTM e política de link),
  [ADR 0001](../adr/0001-campanha-brief-ativo-distribuicao.md), `docs/plano-presenca-social.md`
  (X com 4 posts por semana, resumo técnico e building in public)

## Problema

O X já é gerável desde `a3d795a`: `prompts/channels/twitter.md`, o adaptador `twitter` no
tenant e `src/channels/twitter.js` com `splitThread`. Mas a publicação real lança erro, a
plataforma não conhece o canal (sem slot, sem rota no scheduler) e o CI não gera X. Na
prática, nada de X sai.

## Resultado esperado

Eu aprovo um post de X na plataforma como aprovo um de LinkedIn. No horário do slot, o
scheduler publica o tweet (ou a thread), com imagem ou vídeo quando houver, e responde ao
último tweet com o link UTM da distribuição.

**Fora de escopo:** insights do X (leitura custa por chamada no pay-per-use), interação com
posts de terceiros, publicação de X pelo pipeline Node (o Node só gera; quem publica é a
plataforma), OAuth 2.0 com refresh.

## Decisões

1. **Chave do canal continua `twitter`** (tenant, pendências, prompts). Só o `utm_source` é
   `x`, como a SPEC 001 R1 já define.
2. **OAuth 1.0a user context.** Token de usuário não expira, então o scheduler na Vercel não
   precisa guardar e girar refresh token (OAuth 2.0 expira em 2h). Assinatura HMAC-SHA1 com
   `node:crypto`, sem dependência nova.
3. **Thread pela legenda.** A legenda aprovada é quebrada por `splitThread` (parágrafo,
   depois frase, 280 caracteres). Linha em branco na edição controla onde quebra o tweet.
4. **Custo (pay-per-use desde fev/2026):** US$ 0,015 por post, US$ 0,20 por post com link.
   O link vai só na resposta, então uma thread de 3 tweets + resposta custa cerca de
   US$ 0,25. Com 4 posts por semana, cerca de US$ 1 por semana.

## Requisitos

### R1. Adaptador `platform/src/lib/channels/x.ts`

1. `splitThread(text)` igual ao do Node (mesmos casos de teste).
2. `createPost({ text, mediaIds?, replyTo? })` em `POST /2/tweets`.
3. `uploadImageFromUrl(url)`: baixa a arte e sobe em `POST /2/media/upload` (multipart,
   `media_category=tweet_image`).
4. `uploadVideoFromUrl(url)`: chunked em `/2/media/upload/initialize`, `/{id}/append`
   (blocos de 4 MB), `/{id}/finalize`, e espera `processing_info.state = succeeded`
   consultando `GET /2/media/upload?command=STATUS` (teto de 90 s).
5. `publishThread({ tweets, imageUrl?, videoUrl? })`: mídia só no primeiro tweet; cada
   tweet seguinte responde ao anterior. Retorna `{ id, ids[], url }`. `splitThread` mora em
   `lib/thread.ts` (puro) pra prévia no cliente não puxar `node:crypto`.
6. `replyWithLink(tweetId, text)`.
7. Credenciais em `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.
   Faltou uma: erro que diz qual variável configurar.

### R2. Scheduler

1. `Channel` ganha `twitter`; uma lista `CHANNELS` única alimenta a rota `next-slot` e o
   editor de slots.
2. `publishToChannel` publica a thread e, com `LINK_POLICY.twitter = 'reply'`, responde ao
   último tweet com o link (a SPEC 001 dizia "primeiro tweet"; numa thread isso intercala o
   link entre os tweets, então vale o último, que no post único é o próprio). Falha na
   resposta não vira retry (a thread já está no ar): registra e avisa, como o comentário
   do LinkedIn.
3. Thread parcial (tweet N falhou depois do 1º sair) também não pode virar retry: grava o
   que saiu, marca o erro e avisa.
4. Aprovação mostra a prévia da thread (tweets e contagem por tweet).
5. `mediaKindOf`: `thread` com 2+ tweets, `image` com arte, senão `text`. O scheduler já
   publica `video_url` quando houver; o vínculo do ativo de vídeo (SPEC 001) com o X entra
   junto com o Reels.

### R3. Geração

1. `CHANNELS` no `post.yml` passa a incluir `twitter` (variável do repo, sem mudar código).
2. Tenant: `twitter.publish = true` só quando as credenciais estiverem no ar.

## Critérios de aceite

- Testes de `x.ts` (assinatura OAuth contra o exemplo oficial, `splitThread`, encadeamento
  da thread, link na resposta, upload de vídeo com polling) passando sem rede.
- `tsc --noEmit` da plataforma limpo.
- Teste manual: um slot de X, uma pendência aprovada, `publish-due` publica a thread e a
  resposta com UTM no perfil do Pilar.
