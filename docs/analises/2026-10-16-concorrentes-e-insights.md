# Concorrentes e insights para a plataforma (16/10/2026)

> Pesquisa, não decisão. Contexto: [viabilidade](2026-10-16-viabilidade-saas.md) e
> [ADR 0004](../adr/0004-construir-o-saas-sem-cnpj-validando-com-a-pilar.md).
> Fonte: páginas públicas e prints em `assets/2026-10-16/`. Não entrei em nenhum app pago, então
> isto descreve o posicionamento e a promessa, não a qualidade por dentro. Páginas de marketing
> superestimam o produto.

## O que cada um é hoje

| Ferramenta | Posicionamento atual | Print |
| --- | --- | --- |
| Blotato | API e MCP de redes sociais para agentes (Claude, ChatGPT, Cursor). 9 plataformas, US$ 29 fixo, 20 contas, posts ilimitados, créditos só para imagem e vídeo | `blotato-home.jpg`, `blotato-features.jpg`, `blotato-features-cards.jpg`, `blotato-agents.jpg` |
| Predis.ai | Virou gerador de anúncios (vídeo, UGC, imagem). Mede o vencedor e mostra anúncios de concorrentes. Auto-post só do plano Rise | `predis-home.jpg` |
| Hootsuite | Trocou o OwlyWriter pelo Wisdom, agente de chat com acesso a inbox, calendário e social listening | `hootsuite-wisdom-faq.jpg` |
| Buffer | "Social media sidekick": ideia, reescrita e post por plataforma. Gerador público sem login. Lançou Insights | `buffer-ai-assistant.jpg`, `buffer-resultado.jpg` |
| Metricool | IA por créditos (5, 20 e 35 por marca por mês). Trocou 5 opções por 1 post com atalhos de ajuste. Tem Flows (DM por comentário) e dashboards de campanha | `metricool-ai.jpg` |
| mLabs | IA de legenda por rede e insight de desempenho. R$ 29,90 por marca por mês no anual (Pix), teste sem cartão | `mlabs-ia.jpg` |

Não detalhados: Later, Etus, Postgrain, Reportei, Publer, Sprout (só o que a busca devolveu).

## Observações

1. **Blotato mira o agente, não a pessoa.** O site tem uma página inteira escrita para agentes de
   IA se configurarem (`/agents`). O produto é a tubulação (publicar, agendar, DM, métricas) e a
   inteligência é do agente do cliente.
2. **LinkedIn é o buraco de analytics.** O Blotato lista métricas em 8 plataformas, exceto
   LinkedIn.
3. **Fontes como entrada.** Blotato: link de YouTube, TikTok, PDF, áudio, texto ou consulta no
   Perplexity viram post.
4. **DM por palavra-chave.** Blotato e Metricool (Flows) automatizam "comente 'preço' e receba o
   link por DM". Fecha o buraco de atribuição do feed do Instagram.
5. **O ciclo de desempenho é o produto.** Predis tem "Your winner" e "Cut and Scale", mas o ciclo
   deles é ROAS de anúncio.
6. **O argumento do Hootsuite é dado próprio.** O FAQ do Wisdom diz que IA genérica "não tem acesso
   aos seus dados sociais".
7. **Metricool removeu as 5 opções.** Um post bom com atalhos (encurtar, tom, CTA, traduzir).
8. **mLabs aprova e reprova na legenda**, compara com a média do mercado, cobra por marca, aceita
   Pix e não pede cartão no teste.
9. **Buffer usa gerador público sem login** como isca de aquisição.

## O que levar para a plataforma (ideias, não decisões)

| Ideia | Por quê | Observação |
| --- | --- | --- |
| Expor a plataforma como API ou MCP | O mercado vai para "traga o seu agente" | Gerar texto é commodity, o ciclo e o contexto do nicho não são |
| Usar o funil da Pilar como argumento | É o argumento do Hootsuite aplicado ao seu dado | SPEC 004 já alimenta o bandit com cadastros e ativações |
| DM por palavra-chave para o Instagram | Resolve a atribuição fraca do feed (limitação do ADR 0001) | Exige permissão de mensagens, que passa por review próprio. Inferência minha |
| Regenerar com instrução por botão ("mais curto", "adicione uma conta concreta") | Metricool e mLabs ajustam em vez de oferecer várias opções | O "regenerar com nota" já existe, falta o atalho por clique |
| Gerador gratuito sem login para escritório de projeto | Buffer usa como aquisição | Exemplo: "calcule o custo do seu projeto" |
| Preço por marca no Brasil, com Pix e teste sem cartão | mLabs ancora em ~R$ 30 por marca | Preço do SaaS só quando passar o gate do ADR 0004 |
| Cobrar mídia gerada por crédito | Blotato e Metricool cobram assim | Custo de imagem e vídeo ainda não medido |

## Teste comparado (mesmo briefing)

| | Pipeline próprio (main) | Buffer (gerador público) |
| --- | --- | --- |
| Tempo | 35 s para o conjunto | ~15 s |
| Saída | Uma ideia, LinkedIn como mãe, Instagram reaproveitado, X locked | 1 texto |
| Adaptado por rede | Sim | Não |
| Campanha | Sim (SPEC 003) | Não |
| "Conta concreta" do briefing | Parcial ("3 dias extras", sem R$) | Sim, com valores inventados |

Detalhes e a rodada descartada: [viabilidade](2026-10-16-viabilidade-saas.md#testes).
