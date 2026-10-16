# SPEC 003: uma ideia para todas as redes, reaproveitamento e feedback que vira regra

- **Status:** proposta
- **Data:** 2026-10-15
- **Depende de:** [ADR 0001](../adr/0001-campanha-brief-ativo-distribuicao.md) (brief, ativo,
  distribuição), [ADR 0002](../adr/0002-plataforma-como-produto-proprio.md) (plataforma como
  produto), [SPEC 001](001-sistema-de-campanha-fase-a.md) R3 (modo brief, que esta spec
  substitui), [SPEC 002](002-canal-x.md) (X)

## Problema

Hoje cada rede é um post gerado do zero. O `index.js` roda um loop por canal; sem campanha,
feriado ou fila, o bandit sorteia pilar e ângulo **por canal**, então Instagram e LinkedIn saem
sobre assuntos diferentes. Cada canal paga geração completa (3 variações, crítico, judge,
polish) e arte própria, e vira uma pendência separada na aprovação.

Além disso, o único jeito de dizer "não gostei" é rejeitar o post inteiro com um motivo livre,
que vira anti-exemplo de texto. Não dá para dizer "o texto está bom, o visual não", e não dá
para ver nem desligar o que o sistema aprendeu.

## Resultado esperado

1. Cada rodada de geração produz **uma ideia**. Para cada rede, o sistema decide se reaproveita
   o conteúdo-mãe (adapta texto, usa a mesma arte), gera um post próprio sobre a mesma ideia,
   ou pula a rede. Eu vejo essa decisão e posso trocar.
2. Eu aprovo **por ideia**, numa tela só: escolho a variação preferida, vejo e edito a versão
   de cada rede, ligo e desligo cada rede, e escolho o horário de cada uma.
3. Em qualquer post (na aprovação, na rejeição ou depois de publicado) eu registro o que não
   gostei e por quê, separado por aspecto (texto, visual, tom, tema, formato, CTA). Isso entra
   no prompt das próximas gerações, e eu vejo e controlo as regras que saíram daí.

**Fora de escopo:** login por tenant e cobrança (ADR 0002), Planner semanal automático, métricas
do X, interação com posts de terceiros, Reels no X.

## Decisões

1. **A unidade é o brief** (tabela `briefs`, já criada na 0006). Pilar e ângulo são escolhidos
   uma vez por rodada; todos os canais herdam.
2. **Plano de aproveitamento por regra, não por LLM.** Uma tabela no tenant diz, para cada
   formato do conteúdo-mãe, o que cada rede faz por padrão. Regra é previsível, barata e
   editável; o LLM não gasta token decidindo isso.
3. **Adaptar custa uma chamada, não um pipeline.** Reaproveitar = 1 chamada ao modelo barato
   com o texto aprovado do conteúdo-mãe e as características da rede (sem 3 variações, sem
   crítico, sem judge) e a mesma arte. Post próprio usa o pipeline completo, como hoje.
4. **Feedback é dado estruturado, regra é derivada.** O feedback fica cru numa tabela; as regras
   continuam em `style_rules`, agora com origem e aspecto. O que entra no prompt são regras,
   nunca o feedback cru inteiro.
5. **Efeito rápido e consolidação semanal.** O feedback dos últimos 14 dias entra direto no
   prompt como "evite" (efeito na próxima geração). O `reflect` semanal consolida feedback e
   edições em regras duráveis.

## Requisitos

### R1. Uma ideia por rodada

1. `index.js` escolhe pilar e ângulo uma vez (bandit, campanha, feriado ou fila, na ordem de
   hoje) e grava um `briefs` com `idea`, `evidence`, `cta` e `status = producing`.
2. O canal-mãe é o primeiro canal ligado no `formats_mix` da campanha; sem campanha, LinkedIn
   para pilar `building` e `dor`, Instagram para `dica` (carrossel) e `prova`.
3. O canal-mãe roda o pipeline completo (3 variações, crítico, judge, polish, guardrails, arte).
4. A pendência passa a ser por brief: `pending_approvals.brief_id`, uma linha com o conteúdo-mãe
   e as versões por canal. Uma ideia esperando aprovação não bloqueia a próxima rodada.

### R2. Plano de aproveitamento

1. Tenant ganha `reuse`: para cada formato do conteúdo-mãe, o modo de cada rede (`reuse`,
   `own`, `skip`). Padrão:

   | Conteúdo-mãe | LinkedIn | Instagram | X |
   | --- | --- | --- | --- |
   | Texto LinkedIn (longo) | mãe | `own` | `reuse` (thread do texto) |
   | Carrossel IG | `reuse` (mesmos slides em PDF) | mãe | `reuse` (thread + 1º slide) |
   | Foto-pergunta IG | `skip` | mãe | `reuse` (pergunta + mesma imagem) |
   | Texto curto / prova | `reuse` | `reuse` (mesma arte) | `reuse` |

2. `reuse`: 1 chamada ao modelo barato com o texto da variação top do conteúdo-mãe e o bloco
   de plataforma do tenant (tom, limite, formato). Arte e slides são os mesmos arquivos do
   conteúdo-mãe, sem render novo. Guardrails rodam na versão adaptada.
3. `own`: pipeline completo para aquela rede, com o mesmo pilar, ângulo e evidência.
4. Rede com `publish: false` ou sem credencial (X hoje) não é gerada, mas aparece no plano como
   travada.
5. Cada geração grava `usage` (tokens de entrada e saída por chamada, do `usageMetadata` do
   Gemini) em `generation`, somado por brief.

### R3. Aprovação por ideia (plataforma)

1. Inbox lista ideias: pilar, ângulo, ideia, redes previstas e idade.
2. Tela da ideia:
   - as 3 variações do conteúdo-mãe; escolher uma atualiza as versões `reuse` na próxima
     adaptação (botão "Readaptar redes");
   - um cartão por rede com: liga/desliga, modo (`Reaproveitar` / `Post próprio`), prévia no
     formato da rede (imagem ou carrossel no IG, texto e PDF no LinkedIn, thread no X), legenda
     editável, horário (próximo slot ou manual);
   - rede travada mostra o motivo e o próximo passo ("Configure as credenciais do X para
     ligar");
   - "Post próprio" e "Readaptar" gravam um pedido na pendência; o `resolve` (cron curto, como
     a regeneração do Telegram) gera e atualiza a pendência.
3. "Aprovar" cria um `scheduled_posts` por rede ligada, todos com o mesmo `brief_id`, e marca o
   brief como `approved`. Rede desligada vira `skip` registrado (é sinal de preferência).
4. "Rejeitar ideia" pede o feedback do R4 antes de descartar.

### R4. Feedback "o que não gostei"

1. Migration `0007_feedback.sql`: tabela `feedback` com `tenant_id`, `brief_id`,
   `scheduled_post_id`, `channel` (null = todas), `aspect` (`texto | visual | tom | tema |
   formato | cta`), `sentiment` (`negativo | positivo`), `note` (texto livre), `created_at`.
   RLS ligada, acesso por service role.
2. Onde registrar: na tela da ideia (por rede ou para todas), ao rejeitar, e no histórico de
   publicados. Formulário curto: aspecto (obrigatório), o que não gostou e por quê (texto),
   vale para esta rede ou todas.
3. `generate.js` injeta um bloco "Evite (feedback recente)" com até 8 feedbacks negativos dos
   últimos 14 dias do canal (ou de todas as redes), agrupados por aspecto.
4. Feedback de `visual` entra no prompt de imagem (`buildImagePrompt`) e na escolha de cena,
   não no prompt de texto.
5. Feedback positivo ("gostei do visual porque...") entra como referência curta, com o mesmo
   limite.

### R5. Regras aprendidas, visíveis e controláveis

1. `style_rules` ganha `aspect` e `source` (`edicao | feedback | manual`).
2. `reflect.js` passa a ler também `feedback` e consolida em regras curtas e imperativas, com a
   evidência (quantos feedbacks e edições geraram a regra).
3. Tela "O que aprendi" em /settings: lista as regras ativas por aspecto e rede, com origem e
   evidência; permite desligar, editar e criar regra manual.
4. Limite de 12 regras ativas por canal no prompt (como hoje), as mais recentes primeiro.

### R6. Sinais de preferência

Gravados em `post_events`, por brief: variação escolhida, edição por rede, rede ligada ou
desligada, modo trocado (`reuse` para `own` e vice-versa), rejeição com feedback. O `reflect`
usa esses sinais; o bandit continua usando engajamento.

## Critérios de aceite

- Uma rodada com Instagram e LinkedIn gera um brief, uma pendência e o mesmo pilar e ângulo nas
  duas redes.
- No caso "texto curto", reaproveitar gasta pelo menos 40% menos tokens por ideia do que hoje
  (medido pelo `usage` do R2.5 em 5 rodadas de cada modo).
- A aprovação de uma ideia com IG e LinkedIn ligados e X travado cria 2 `scheduled_posts` com o
  mesmo `brief_id`.
- Um feedback "visual: fundo escuro demais" registrado hoje aparece no prompt de imagem da
  próxima geração e não aparece no prompt de texto.
- Desligar uma regra em /settings tira a regra da próxima geração.
- Testes: plano de aproveitamento (tabela do R2), montagem do bloco de feedback (R4.3 a R4.5),
  agrupamento por brief na aprovação. `tsc --noEmit` limpo.

## Entregas

1. **PR A, geração:** R1, R2, migração de `pending_approvals.brief_id`, `usage`.
2. **PR B, plataforma:** R3 e R6.
3. **PR C, feedback:** R4 e R5 (migration 0007, formulário, bloco no prompt, tela de regras).

A PR C não depende das outras e pode ir primeiro, se o feedback for mais urgente.
