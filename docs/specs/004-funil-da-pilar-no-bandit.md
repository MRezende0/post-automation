# SPEC 004: funil da Pilar dentro do aprendizado

- **Status:** em implementação
- **Data:** 2026-10-16
- **Depende de:** ADR 0061 e SPEC 128 do repo da Pilar (`ops-export-funil`), [SPEC 001](001-sistema-de-campanha-fase-a.md) R1 (UTM por distribuição), [ADR 0002](../adr/0002-plataforma-como-produto-proprio.md)

## Problema

O bandit aprende com engajamento (salvamento, comentário, curtida por mil de alcance). O
objetivo do lançamento é cadastro ativado. A Pilar já devolve, por UTM, quantos cadastros,
ativados e pagantes cada link trouxe, mas nada aqui lê isso.

## Contrato (lado Pilar, não muda aqui)

`GET {PILAR_FUNNEL_URL}?desde=AAAA-MM-DD&ate=AAAA-MM-DD`
com `Authorization: Bearer <OPS_EXPORT_TOKEN>`. Janela máxima de 120 dias.

```json
{ "gerado_em": "...", "desde": "...", "ate": "...",
  "linhas": [{ "dia": "2026-11-20", "utm_source": "linkedin", "utm_medium": "organico",
               "utm_campaign": "quanto-custa-um-projeto", "utm_content": "d1122ee5d",
               "cadastros": 3, "ativados": 1, "pagantes": 0 }] }
```

- `dia` é o dia do **cadastro** (Brasília). `ativados` e `pagantes` são o estado de **hoje** das
  empresas daquela coorte: um dia já exportado muda depois, e pagante pode voltar a 0.
- Sem dado pessoal. UTM ausente no cadastro vem `null`.

## Requisitos

1. **Coleta diária** (`npm run funnel`, workflow `funnel.yml` às 06h30 de Brasília): pede os
   últimos 120 dias, **valida o formato na entrada** (falha clara se a Pilar mudar o contrato)
   e regrava a janela inteira em `funnel_daily`: upsert pela chave completa e remoção das linhas
   da janela que não vieram nesta rodada.
2. **Liga ao post:** `utm_content` no formato `d` + 8 hex é o id curto da distribuição
   (`scheduled_posts.utm->>'content'`); daí para `posts` pelo `post_id`. O total do post fica em
   `posts.funnel` (`{ cadastros, ativados, pagantes, atualizado_em }`).
3. **Recompensa do bandit:** `rewardScore = engagement_score + 10 × cadastros + 50 × ativados +
   200 × pagantes`. Um ativado vale o mesmo que 50 pontos de engajamento por mil de alcance.
   Pesos iniciais, recalibrar depois de 4 semanas com dado.
4. **Relatório semanal:** funil dos últimos 7 dias de cadastro por canal e campanha e os 3 posts
   com mais ativados.
5. **Histórico na plataforma:** cada post publicado mostra cadastros, ativados e pagantes quando
   houver.
6. Sem `PILAR_FUNNEL_URL` ou `OPS_EXPORT_TOKEN`, o job avisa e termina sem erro.

## Fora de escopo e limites conhecidos

- **Instagram não tem atribuição por post**: o feed não tem link, e a bio usa
  `utm_content=bio`. Esses cadastros aparecem no relatório por campanha, mas não entram na
  recompensa de nenhum post. Pilar que vai mais para o LinkedIn pode ganhar vantagem no bandit;
  avaliar depois de 4 semanas.
- Posts com mais de 120 dias mantêm o último total conhecido.
- Sinais de preferência da aprovação (`post_events` `idea_decision`, SPEC 003) não entram ainda.

## Critérios de aceite

- [ ] Resposta com campo faltando ou contagem negativa é rejeitada antes de gravar.
- [ ] Rodar duas vezes seguidas deixa `funnel_daily` igual (idempotente).
- [ ] Linha que sumiu da resposta (combinação de UTM sem cadastro hoje) sai da janela.
- [ ] Um `utm_content` de distribuição publicada atualiza `posts.funnel` do post certo.
- [ ] Entre dois posts de mesmo engajamento, o que trouxe ativado tem recompensa maior no
      bandit.
- [ ] Sem credenciais, o job termina com código 0 e uma linha de aviso.

## Deploy

1. Aplicar `0010_funnel.sql`.
2. Matheus gera o token (`openssl rand -hex 32`), um por ambiente, e coloca no Pilar
   (secret das Edge Functions) e aqui: `OPS_EXPORT_TOKEN` como secret do GitHub Actions e
   `PILAR_FUNNEL_URL` como variável do repo, com a URL completa da função:
   - produção: `https://vepnsonbnsimqcsfcagm.supabase.co/functions/v1/ops-export-funil`
     (responde depois do próximo release da Pilar);
   - staging, para teste: `https://rizaklgstyfrwgmdsldf.supabase.co/functions/v1/ops-export-funil`,
     com token próprio.
