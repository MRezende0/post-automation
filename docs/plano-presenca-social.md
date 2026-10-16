# Plano de presença social da Pilar (lançamento jan/2027)

> Cérebro do agente de marketing. Diz o que cada perfil transmite, que formato existe, quando
> publicar, que campanha roda em cada fase, como medir e o que o agente decide toda semana.
> Lê junto com `posicionamento.md`, `pilares.md`, `voice.md` e `brand.md`.
> Contrato com o Pilar: ADR 0061 e SPEC 128 no repo do produto (a Pilar só devolve o funil por UTM;
> nenhuma métrica de rede vai para lá). Aqui: [ADR 0002](adr/0002-plataforma-como-produto-proprio.md) e [SPEC 004](specs/004-funil-da-pilar-no-bandit.md).
> Data guia: lançamento público na terça, 19/01/2027 (T0). Antecipar é permitido.

## 1. O que o perfil transmite

**Uma frase:** a Pilar é quem mostra ao dono do escritório de projeto se cada projeto está
dando lucro antes de terminar.

**Personalidade:** engenheiro falando com engenheiro. Direta, técnica na medida, generosa
com conhecimento (entrega a conta, o checklist, o modelo), mostra número de verdade, sem
hype e sem emoji corporativo. Planilha é o vilão de entrada; lucro por projeto é o destino.

**Quem a gente quer parando o scroll:** sócio ou dono de escritório de engenharia de
projeto (civil, estrutural, MEP) ou de arquitetura, 3 a 30 pessoas, que orça no feeling e
descobre a margem no fim. Não é construtora, não é incorporadora.

### Papel de cada canal

| Canal | Perfil | Papel | Prioridade |
| --- | --- | --- | --- |
| LinkedIn | pessoal do Matheus | building in public, dor e dica em texto, carrossel em PDF; maior alcance orgânico B2B | 1 |
| LinkedIn | página Pilar | repost, anúncio de produto, prova social, anúncios pagos | 2 |
| Instagram | @pilar.software | vitrine: foto-pergunta, carrossel, Reels, stories de bastidor; prova social | 1 |
| YouTube Shorts | Pilar | espelho dos Reels, custo zero | 3 |
| X | Pilar | resumo técnico e building in public reaproveitado; sem métrica paga | 4 |
| WhatsApp | Matheus | conversão: link na bio e no post leva a conversa ou cadastro | conversão |

### Perfil arrumado (fazer na fase A)

- **Bio Instagram:** "Saiba se cada projeto está dando lucro antes de terminar. Gestão para
  escritórios de engenharia e arquitetura. Teste grátis por 3 dias." Link com
  `utm_source=instagram&utm_medium=bio&utm_campaign=perfil`.
- **Destaques:** Como funciona, Clientes, Dicas, Bastidores, Planos.
- **LinkedIn pessoal:** título "Construindo a Pilar: lucro por projeto para escritórios de
  engenharia e arquitetura"; seção Em destaque com o vídeo demo e o link de teste.
- **Página LinkedIn:** mesma tagline, botão "Teste grátis" com UTM.

## 2. Catálogo de formatos

Cada formato tem objetivo, pilar, estrutura, como a automação produz e a métrica que decide
se ele fica.

### Foto-pergunta (desenho + pergunta)

- **Objetivo:** comentário e salvamento; puxa a voz do cliente.
- **Pilar:** dor (principal), dica.
- **Estrutura:** traço de croqui técnico (prancha, cota, carimbo, régua) em ink sobre
  paper, um elemento em verde-lima, e uma pergunta de no máximo 12 palavras. Exemplos:
  "Qual projeto seu deu prejuízo em 2026?", "Você cobra a revisão 3 ou faz de graça?",
  "Quanto vale a hora do sócio no seu orçamento?". Legenda curta + pedido de resposta.
- **Automação:** template HTML novo em `templates/` (`foto-pergunta`), ilustrações SVG de
  croqui numa biblioteca fixa (20 a 30 peças) e o modelo escolhe peça + pergunta. Render pelo
  `render-image.js`.
- **Métrica que decide:** comentários por mil de alcance e salvamentos.

### Carrossel (vários itens)

- **Objetivo:** salvamento, compartilhamento, autoridade.
- **Pilar:** dica (principal), prova.
- **Estrutura:** 7 slides. Capa com gancho, 5 slides com um item cada (ação + por quê), slide
  final com resumo e CTA leve. No LinkedIn sai como documento PDF.
- **Automação:** já existe (`renderCarousel`, `publishCarousel`). Falta a saída em PDF para o
  LinkedIn.
- **Métrica que decide:** salvamentos e compartilhamentos por mil de alcance.

### Reels sem rosto

Três tipos, todos com legenda queimada (assistem sem som):

1. **Tela do produto (15 a 30 s):** uma tarefa real no Pilar (ver margem do projeto, aditivo
   preparado, portal do cliente). Gravado na UI real com dados encenados, montado em
   HyperFrames.
2. **Texto cinético (10 a 20 s):** dor em staccato no ritmo da landing ("Projeto estoura
   prazo. Proposta no feeling. Financeiro descolado."), fechando com a tagline.
3. **Conta rápida (20 a 40 s):** uma conta de margem na tela (honorário, horas, revisões) que
   mostra o prejuízo escondido.

- **Automação:** `reel.js` já gera o roteiro. Falta a etapa de render: roteiro → composição
  HyperFrames por template → voz pt-BR (edge-tts `pt-BR-AntonioNeural` ou
  `pt-BR-FranciscaNeural`) → render → aprovação.
- **Métrica que decide:** retenção média, views de 3 s e compartilhamentos.

### Reels com apresentador humano

- Já existem vídeos gravados. O agente corta em versões de 30 s com legenda, sugere o
  roteiro dos próximos (gancho em 3 s, uma ideia, CTA), e a gravação continua humana.
- **Métrica que decide:** a mesma dos Reels, comparada com os sem rosto. É o teste que diz se
  rosto vale o custo de gravar.

### Texto LinkedIn (founder)

- **Objetivo:** alcance e conversa. Melhor formato orgânico B2B.
- **Pilar:** building in public, dor.
- **Estrutura:** a de `voice.md` (primeira linha forte, frases curtas, sem link no corpo; o
  link vai no primeiro comentário).
- **Métrica que decide:** impressões, comentários de pessoas do ICP, visitas ao perfil.

### Enquete e caixinha

- LinkedIn (enquete) e stories (caixinha, enquete). A resposta alimenta
  `voz-do-cliente.md` e `dores.md`.

### Prova social

- Depoimento autorizado, antes e depois, número de uso. Só com autorização escrita do
  escritório. Antes do lançamento entra pouco (15%); depois do lançamento sobe.

## 3. Cadência semanal

Base sustentável para uma pessoa aprovando. Fase A roda a metade; fase B em diante, cheia.

| Dia | LinkedIn pessoal | Instagram | X | Stories |
| --- | --- | --- | --- | --- |
| Seg | texto de dor | foto-pergunta | resumo do texto | bastidor |
| Ter | | Reels (tela do produto) | | enquete |
| Qua | carrossel PDF de dica | carrossel de dica | fio curto | repost |
| Qui | | Reels (texto cinético ou conta) | | caixinha |
| Sex | building in public | | resumo | bastidor |
| Sáb | | Reels humano ou prova | | |

Shorts espelham os Reels. Horários iniciais: 8h e 12h30 (LinkedIn), 12h e 19h
(Instagram). O agente ajusta pelo alcance depois de 4 semanas.

## 4. Calendário até o lançamento

| Fase | Datas | Objetivo | O que roda |
| --- | --- | --- | --- |
| A. Fundação | 20/10 a 15/11 | perfis prontos, formatos testados, linha de base | perfis arrumados; templates de foto-pergunta e carrossel; render de Reels; UTM em tudo; meia cadência; 4 semanas de dado por formato |
| B. Audiência | 16/11 a 20/12 | crescer seguidor do ICP e lista | cadência cheia; série "Quanto custa um projeto"; isca: calculadora de margem por projeto na landing; primeiro teste pago pequeno com o melhor Reels |
| Festas | 21/12 a 04/01 | manter presença sem esforço | agendado leve: retrospectiva, "planeje 2027", dicas evergreen |
| C. Pré-lançamento | 05/01 a 18/01 | criar expectativa | contagem regressiva; bastidores da reta final; vídeo demo de 90 s; convite para a turma de lançamento (condição definida pelo agente de pricing) |
| T0 | ter 19/01 | anunciar | post do founder no LinkedIn + página; Reels demo de 30 s; carrossel "o que é a Pilar"; e-mail para a base; WhatsApp para a rede pessoal; live na qui 21/01 "como saber se o projeto dá lucro" |
| D. Pós-lançamento | 20/01 a 18/02 | converter e provar | cases dos primeiros escritórios; tutorial curto por módulo; objeções respondidas; retargeting pago de quem visitou a landing |

### Campanhas para o `content/campaigns.yaml`

Proposta pronta para colar depois de aprovada:

```yaml
- name: Quanto custa um projeto
  start: 2026-11-16
  end: 2026-12-20
  context: |
    Série de dica e dor sobre custo real de projeto: hora do sócio, revisões não
    cobradas, retrabalho por versão errada, prazo que estoura. Cada peça mostra uma
    conta concreta e termina com a pergunta "você sabe esse número no seu escritório?".
    Engenharia de projeto e arquitetura, nunca obra.
- name: Planeje 2027
  start: 2026-12-21
  end: 2027-01-04
  context: |
    Conteúdo leve de virada de ano: o que medir em 2027, quais projetos repetir,
    qual cliente não aceitar de novo. Sem venda direta.
- name: Pré-lançamento
  start: 2027-01-05
  end: 2027-01-18
  context: |
    Bastidores da reta final e contagem regressiva para 19/01. Mostra trechos reais do
    produto e o porquê de cada decisão. CTA: entrar na turma de lançamento.
- name: Lançamento
  start: 2027-01-19
  end: 2027-01-25
  context: |
    A Pilar está aberta. Tagline "Saiba se cada projeto está dando lucro antes de
    terminar." Mostra o fluxo proposta → projeto → cobrança → lucro. CTA: testar grátis.
- name: Prova
  start: 2027-01-26
  end: 2027-02-18
  context: |
    Casos dos primeiros escritórios (só com autorização), objeções respondidas e
    tutoriais curtos por módulo.
```

## 5. Vídeo

- **Demo de 90 s** (landing, YouTube, LinkedIn em destaque) e cortes de 30 s (Reels,
  LinkedIn) e 15 s (anúncio).
- **Como produzir:** UI real do Pilar em staging com uma empresa de demonstração semeada,
  gravação por Playwright com screencast em 2x, cursor redesenhado em pós, composição em
  HyperFrames, voz pt-BR, música com ducking, legenda queimada nos cortes curtos.
- **Referência:** o método do vídeo do Precursal está descrito no cofre
  (`product-demo-video-from-real-ui-with-staged-api`). Os scripts e os assets daquele
  vídeo são da Labrynth e não são copiados: o pipeline da Pilar é refeito do zero, com o
  mesmo método.

## 6. Tráfego pago

Só depois de 4 semanas de linha de base orgânica, e sempre promovendo o que já provou no
orgânico.

| Canal | Quando | Uso | Coleta de métrica |
| --- | --- | --- | --- |
| Meta (Instagram) | fase B em diante | impulsionar o Reels com melhor retenção; retargeting de quem visitou a landing | Marketing API (`ads_read`) no mesmo app Meta, automático |
| Google Search | fase C em diante | intenção alta: "software para escritório de engenharia", "sistema para escritório de arquitetura", "gestão de projetos de engenharia" | Google Ads API (pedir developer token já na fase A; até sair, CSV semanal) |
| LinkedIn Ads | só na semana do T0 | documento ou formulário com a calculadora, segmentado por cargo (sócio, diretor) e setor | exige aprovação da Marketing API; até sair, CSV semanal |

**Métrica que manda:** custo por cadastro ativado (cadastrou e criou o primeiro projeto).
CPM, CTR e CPC aparecem, mas não decidem.

## 7. Site, palavras-chave e conversão

- **Search Console (API gratuita):** consultas, impressões, CTR e posição por página, todo
  dia. Grupos de palavra-chave para acompanhar:
  - produto: software, sistema, gestão + escritório de engenharia, escritório de
    arquitetura, projetos de engenharia;
  - dor: como precificar projeto de engenharia, honorários de arquitetura, margem de
    projeto, controle de horas em escritório;
  - concorrência: alternativa a planilha de projetos, ERP para engenharia.
- **Desempenho do site:** Core Web Vitals reais pelo PostHog (SPEC 125) e PageSpeed
  Insights da home uma vez por dia.
- **Conversão (CRO):** funil visita → rolagem 50% → clique no CTA → cadastro iniciado →
  cadastro concluído → primeiro projeto. Um experimento A/B por vez no hero ou no CTA, por
  feature flag do PostHog.

## 8. Métricas e metas iniciais

Metas de partida, recalibradas pelo agente depois de 4 semanas de dado.

| Etapa | Métrica | Meta inicial |
| --- | --- | --- |
| Alcance | alcance semanal somado (IG + LinkedIn) | crescer 10% por semana na fase B |
| Engajamento | salvamentos + compartilhamentos por mil de alcance | carrossel acima de 15 |
| Intenção | visitas ao perfil e cliques no link por semana | crescer semana a semana |
| Landing | visita → cadastro iniciado | 5% |
| Cadastro | cadastro iniciado → concluído | 60% |
| Ativação | cadastro → primeiro projeto em 3 dias | 40% |
| Pago | custo por cadastro ativado | definir após o primeiro teste |

### Padrão de UTM (obrigatório em todo link)

- `utm_source`: instagram, linkedin, x, youtube, whatsapp, email, meta_ads, google_ads,
  linkedin_ads
- `utm_medium`: organico, pago, bio, dm, story
- `utm_campaign`: slug da campanha (`quanto-custa-um-projeto`, `lancamento-2027-01`)
- `utm_content`: id do post na fila, ou `bio`

Com `utm_content` = id do post, o Pilar devolve cadastros e ativados por post
(`ops-export-funil`), e o bandit passa a premiar o post que trouxe cliente.

## 9. O agente de marketing

Vive neste repo e neste banco, e os painéis ficam nesta plataforma. No Ultra da Pilar, o card
de Marketing só tem o botão "Abrir plataforma de marketing" (ADR 0061).

**Todo dia, 06h:** coleta métricas de Instagram, LinkedIn, X, anúncios, Search Console e
PageSpeed; busca o funil por UTM no Pilar (`ops-export-funil`, SPEC 004). Os painéis ficam nesta
plataforma; a Pilar só abre o link para cá.

**Segunda, 07h:**

1. Lê a semana: o que rendeu por formato, pilar, ângulo, canal e horário, com prêmio
   ponderado (cadastro ativado vale mais que salvamento, que vale mais que alcance).
2. Decide o mix da semana pelo bandit, respeitando os pesos de `pilares.md` e a campanha
   ativa.
3. Gera a pauta (8 a 10 peças) com formato, pilar, ângulo, canal e horário.
4. Produz os rascunhos (texto, arte, roteiro, render do Reels) e manda para aprovação na
   plataforma.
5. Escreve o resumo: o que dobrar, o que cortar, um teste novo para a semana.

**Por mês:** relatório da fase e proposta da próxima campanha.

**Limites:** nunca publica sem aprovação (N1); nunca comenta nem manda mensagem direta
sozinho (termos das redes); comentário de valor continua pelo `engage.js`, com você colando.

## 10. Backlog para este repo

Em ordem:

1. Padrão de UTM com `utm_content` = id do post em todo link gerado.
2. Template `foto-pergunta` + biblioteca de croquis SVG.
3. Carrossel em PDF para o LinkedIn.
4. Render de Reels: roteiro do `reel.js` → HyperFrames → voz pt-BR → aprovação.
5. Coletores: Meta Ads, Search Console, PageSpeed; X só se a leitura for viável.
6. Leitura diária do `ops-export-funil` (SPEC 004). O envio para o `ops-ingest` saiu com o ADR 0061.
7. Prêmio do bandit com cadastro ativado.
8. Pauta semanal automática e resumo de segunda.

## 11. Pendências de alinhamento com o produto

- `posicionamento.md` está atrás do produto: desde 01/09/2026 o ICP inclui arquitetura,
  a tagline oficial é "Saiba se cada projeto está dando lucro antes de terminar." e o Pilar
  tem módulo de Obras para o escritório que acompanha a obra do próprio projeto. O
  anti-posicionamento continua: não é sistema de construtora.
- Fonte única da marca: o `brand/` do repo do Pilar (público). Sugestão: o pipeline lê
  `brand/messaging.md` e `brand/voice-tone.md` direto do GitHub a cada execução, e os
  arquivos daqui viram só o que é específico de rede social.
