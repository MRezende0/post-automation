# Filtro da conversa com o ChatGPT sobre agentes e marketing (15/10/2026)

> Pesquisa de ideias, não decisão. O ChatGPT leu o repo da Pilar (primeiro os agentes errados,
> depois a SPEC 126 e o ADR 0060) e **nunca viu este repo**. Aqui fica o que vale para o
> `post-automation`, o que já existe e o que descartamos, com o motivo.
> Contexto: [ADR 0002](../adr/0002-plataforma-como-produto-proprio.md) (a plataforma é produto
> próprio, a Pilar só redireciona) e o plano de presença social.

## O que já temos (ele propôs sem saber que existe)

| Ideia | Onde já está |
| --- | --- |
| Executor de publicação é código, não LLM | `platform/src/lib/publish.ts`, `channels/*` |
| Idempotência para não duplicar post | lock `scheduled → publishing`, `retry:false` no POST, comentário do link sem retry (#8) |
| Campanha com conteúdo-mãe e derivados por rede | ADR 0001 (campanha, brief, ativo, distribuição) e SPEC 003 |
| UTM e atribuição até a conversão | SPEC 001 R1 (#8), `ops-export-funil` no Pilar |
| Carrossel renderizado por template, não por IA | `templates/`, `renderCarousel` (#10) |
| Aprovação humana antes de publicar | inbox da plataforma, nível N1 em tudo |
| Número do SQL, texto do modelo | ADR 0060 no Pilar |
| Crítico / red team antes de aprovar | `critiqueVariations` + judge multidimensional |

## O que vale adotar

| Ideia | Por que vale | Quando | Como |
| --- | --- | --- | --- |
| **Brand kit por tenant** | a plataforma é produto (ADR 0002); cor e marca não podem morar no HTML | agora | `tenant.brand` + `{{{brand_css}}}` nos templates novos (R4, esta PR). Templates antigos migram quando forem tocados |
| **Matriz de capacidades por canal** (formato, escopo, custo, métrica disponível, fallback manual) | evita a tela oferecer o que a API não faz (story com enquete, métrica do LinkedIn pessoal) | fase A | evoluir `tenant.platforms` para declarar `publish`, `metrics` e `manual` por formato; a inbox lê dali |
| **Pausa global de publicação** | um botão para parar tudo se algo sair errado no lançamento | antes de 19/01 | flag em `/settings` que o `publish-due` respeita |
| **Avaliação com casos reais** (conjunto fixo de briefs que roda a cada mudança de prompt) | prompt muda toda semana com o reflection e o feedback da SPEC 003 | fase B | `tests/evals/` com 10 a 15 briefs; mede guardrails, formato e nota do judge; roda no CI sem publicar |
| **Contrato do agente de marketing** (entradas, saídas, ferramentas, permissões, avaliação) | o Planner semanal vai decidir pauta sozinho | quando o Planner nascer (onda 2) | um arquivo de contrato em `docs/agentes/marketing.md`, lido pelo prompt |
| **Distinguir dado observado de estimado** no analytics | rede social não dá atribuição exata; o painel não pode fingir precisão | onda 2 | cada métrica do snapshot leva `fonte` e `tipo` (`observado` ou `estimado`) |
| **Documento criativo em JSON, independente da biblioteca de canvas** | é o que permite um editor visual depois sem refazer os templates | depois do lançamento | os templates novos já recebem dados estruturados (pergunta, croqui, slides com título e descrição); o editor vira uma camada sobre isso |
| **Proteção contra prompt injection** em fonte externa | agentes de tendência e comentários vão ler texto de terceiros | quando houver fonte externa (F2) | texto externo nunca vira instrução; entra marcado como citação |

## O que descartamos (por enquanto)

| Ideia | Motivo |
| --- | --- |
| Pilar HQ, Command Center e Missões dentro da Pilar | a parte de marketing vive aqui (ADR 0002); os agentes que leem o banco da Pilar já têm o Time no Ultra (SPEC 126) |
| Runtime de agentes novo (pg-boss, Temporal, filas próprias) | o volume é de poucas tarefas por dia; GitHub Actions + cron da plataforma resolvem até haver gargalo medido |
| Remotion para vídeo | já escolhemos HyperFrames (prompt da fábrica de vídeo); trocar agora só custa |
| Editor visual tipo Canva (Fabric.js) antes do lançamento | semanas de trabalho que não trazem cliente até 19/01; volta depois, sobre o documento JSON |
| 15 a 20 agentes especialistas | custo e latência sem ganho; especialista vira habilidade chamada pelo agente de marketing |
| Facebook e blog como canais | fora do plano de presença social; Instagram, LinkedIn e X primeiro |
| Monorepo com `apps/` e `packages/` | reorganizar agora não entrega nada; só se surgir um segundo app |

## Efeito no roadmap

1. **Agora (R4, esta PR):** brand kit por tenant nos templates novos.
2. **Fase A, antes de 19/01:** matriz de capacidades por canal e pausa global de publicação.
3. **Fase B:** evals de geração no CI.
4. **Onda 2:** contrato do agente de marketing e `observado/estimado` nas métricas.
5. **Depois do lançamento:** editor visual sobre o documento criativo em JSON.
