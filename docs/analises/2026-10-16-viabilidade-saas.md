# Viabilidade de transformar o post-automation em SaaS (16/10/2026)

> Pesquisa e análise, não decisão. A decisão está no [ADR 0004](../adr/0004-construir-o-saas-sem-cnpj-validando-com-a-pilar.md).
> Concorrentes, prints e insights: [concorrentes e insights](2026-10-16-concorrentes-e-insights.md).
> Evidência vem de páginas dos fabricantes, comparativos e de dois testes meus. Marquei o que
> **não foi verificado** no fim.

## Veredito

**Go para construir sem CNPJ, com gates antes de abrir empresa e cobrar.** Nenhum bloqueio técnico
ou legal impede a construção. O risco real é construir algo que ninguém pague e a titularidade do
código (ver "Bloqueios que não são técnicos").

## Como o cliente conecta as redes

O cliente cria conta no SaaS e clica em "Conectar Instagram". Abre o login do Instagram (OAuth
2.0), ele aceita uma tela de permissão e volta conectado. O SaaS guarda access token e refresh
token (criptografados), porque sem eles não publica quando o cliente está offline. A senha nunca
passa pelo SaaS.

**O trabalho que doeu na Pilar (app Meta, verificação, permissões) é do dono do app, uma vez.**
Na Pilar o app está em modo desenvolvimento, com o Matheus como admin: serve para contas próprias.
Para contas de terceiros o app precisa de Business Verification, App Review e modo Live. O cliente
nunca vê isso nem verifica o CNPJ dele.

| Rede | Conexão | Dificuldade | Pegadinhas |
| --- | --- | --- | --- |
| Instagram | Instagram Login (não Facebook Login) | Alta, só no review | Só conta Business ou Creator. Com Facebook Login exige Página vinculada, que é a parte dolorosa. 100 posts por 24h por conta (carrossel conta 1). Token de ~60 dias. |
| LinkedIn | OAuth 2.0 | Perfil: baixa. Página: alta | Perfil pessoal é self-serve. Página exige Community Management API, com dois níveis. Nível Development: 500 chamadas/dia por app, 100 por membro, até 12 meses. |
| X | OAuth 2.0 com PKCE | Técnica baixa, custo alto | Pay-per-use desde 06/02/2026: US$ 0,015 por post e US$ 0,20 se tiver link. Novos devs não têm mais planos fixos. |

Vários Instagrams no mesmo CNPJ: **sim**. A verificação é do negócio dono do app, não de cada
conta. Com Advanced Access, qualquer conta profissional que autorizar o app conecta. Não achei teto
de contas por app na documentação (**não verificado**, confirmar com a Meta antes de prometer
"ilimitado"). As contas dos clientes não entram no Business Portfolio do dono do app.

Prazos: Business Verification de 1 a 14 dias úteis (Brasil aceita CNPJ, contrato social ou
certificado MEI). App Review oficial de 2 a 7 dias úteis, mas cada rejeição reinicia o relógio e a
prática é de 3 a 5 semanas. Rejeições comuns: screencast que não mostra o fluxo completo de
publicação e justificativa genérica por permissão.

**A conta Meta da Pilar não deve hospedar o SaaS.** Se pertence ao CNPJ da Trinity, o produto novo
fica atrelado a ela e uma suspensão derruba os dois. Portfólio, app e CNPJ separados.

## Como guardar tokens

- Criptografar em repouso (AES-256-GCM) com chave fora do banco. Nunca expor ao client.
- Tabela por tenant com RLS: `tenant_id`, `provider`, `external_account_id`, tokens, `scopes`,
  `expires_at`, `status`.
- `state` e PKCE no fluxo contra CSRF.
- Job de refresh antes do vencimento. Se falhar, `status = reauth_required` e aviso na UI.
- Botão de desconectar que revoga e apaga. A Meta exige callback de exclusão de dados.
- LGPD: o cliente é controlador, o SaaS é operador. Política de privacidade, termos e DPA.

## Mercado e concorrência

Gerar e agendar é commodity. Quem disputa só "conectar e agendar" perde por preço.

| Segmento | Quem | Preço observado |
| --- | --- | --- |
| Generalistas | Buffer, Hootsuite, Later, Sprout, Metricool, Publer | Buffer US$ 5 a 6 por canal, Hootsuite US$ 99 por usuário, Sprout ~US$ 199 por assento, Metricool com plano grátis |
| IA primeiro | Blotato, Predis.ai | Blotato US$ 29 fixo. Predis Core US$ 19 (sem auto-post), Rise US$ 40 no anual |
| Open source | Postiz (29 mil estrelas, 30+ redes) | Self-host ~US$ 5 a 10, nuvem US$ 29 a 49 |
| Brasil | mLabs (145 mil marcas), Etus, Postgrain, Reportei | mLabs R$ 29,90 por marca no anual (Pix) |
| Infra de API | Ayrshare, Late, Upload-Post | Ayrshare Business US$ 599 por mês, mínimo de perfis |

Tamanho de mercado: os relatórios divergem demais (US$ 19,8 bi com 14% ao ano contra 26% ao ano)
e **não foram usados** na decisão.

### O que cada um entrega, em 5 níveis

1. Agendar. 2. Assistente de escrita por post. 3. Geração em lote. 4. Campanha: uma ideia em várias
peças coerentes por rede. 5. Ciclo fechado: mede, aprende com resultado e com edição humana e liga
ao resultado de negócio.

Buffer, Hootsuite, Sprout, Metricool, Publer e mLabs ficam em 1 e 2. Predis e Blotato chegam a 3
(Blotato expõe analytics a agentes). **Nenhum, nas páginas que vi, mostra 4 e 5 juntos.** Essa é a
lacuna, e ela pode fechar rápido.

## Testes

**Teste 1: Buffer, gerador público (sem conta).** Mesmo briefing da campanha "Quanto custa um
projeto". Saiu um texto único, sem rede, sem imagem e sem campanha, mas com "conta concreta"
(horas × valor = R$, valores inventados). Print: `assets/2026-10-16/buffer-resultado.jpg`.

**Teste 2: pipeline próprio.**
- Primeira rodada (branch defasada, 121 arquivos atrás da `main`): cada rede sorteou um ângulo
  diferente e o top-1 saiu sem conta. **Descartada**: o código antigo não tinha a SPEC 003.
- Reteste na `main` (ideia única por rodada): LinkedIn como mãe, Instagram reaproveitando, X
  `locked` por falta de credencial. **Coerência entre redes resolvida.** A conta concreta saiu
  parcial: "3 dias extras de trabalho", sem R$. Judge 86 (prova 7), 35 s. Saída em
  `assets/2026-10-16/benchmark-main-output.json`, script em `benchmark-main-bench.mjs`.

Limites: uma rodada, um briefing, pilar fixado em "dor". Rodou só com a chave do Gemini, sem
publicar, sem banco e sem upload.

Predis e Blotato **não foram testados por dentro** (exigem conta; nenhuma estava logada e não criei
conta com o e-mail do Matheus).

## Placar

| Pergunta | Leitura |
| --- | --- |
| Tecnicamente viável | Go |
| Legalmente viável | Go, com prazo de review e só quando houver cliente fora |
| Mercado | Saturado em geração e agendamento |
| Concorrente entrega campanha coerente mais ciclo até conversão | Não nas páginas vistas, mas pode fechar |
| O produto já entrega isso | Parcial: ideia única (SPEC 003) feita, funil no bandit (SPEC 004) em implementação, conta concreta ainda parcial |
| O diferencial generaliza | Risco central: cada cliente precisa instrumentar o próprio funil |

## Bloqueios que não são técnicos

1. **Contrato com a Labrynth** (PI, exclusividade, atividade paralela). Não foi lido. Construir em
   tempo próprio não afasta cláusula.
2. **Titularidade:** o repo gera marketing da Pilar e a marca da Pilar é da Trinity. Precisa de
   combinado por escrito antes de ter cliente. Não é aconselhamento legal.

## Custos e sustentabilidade

Projetos assim costumam falhar por manutenção e suporte, não por falta de feature:

- Integração quebra: token vence a cada ~60 dias, a Meta muda política, o X muda preço.
- Suporte por cliente: cada piloto pede conexão manual e conversa sobre resultado.
- Qualidade: a instrução "conta concreta" ainda não é cumprida de forma consistente.
- Custo por campanha (Gemini, imagem, vídeo, X): **não medido ainda**.

## Pagamento e tributação (não pesquisado a fundo)

Stripe Brasil cobra ~3,99% + R$ 0,39 por transação. O cliente brasileiro prefere Pix, e o Pix
Automático reduz cancelamento. Asaas é o caminho comum para assinatura com nota. Regime tributário,
CNAE de SaaS, ISS e venda para fora do Brasil ficam com contador. Nada disso é necessário agora.

## Marca

"Push Automation" foi o nome citado, mas o produto **ainda não tem nome**. Observação para quando
houver: "push" evoca push notification (a busca devolve PushEngage, PushAd, PushPushGo, Push
Property) e é descritivo, o que dificulta registro e SEO. Consultar INPI, domínio e nome de app na
Meta antes de escolher.

## Não verificado

- Tamanho real do mercado de escritórios de engenharia e arquitetura.
- INPI, domínio e disponibilidade de nome.
- Tributação e CNAE do SaaS.
- Custo de mídia gerada (imagem e vídeo) por cliente.
- Teto de contas por app na Meta.
- Predis e Blotato por dentro; Later, Etus, Postgrain e Reportei não foram detalhados.
- Resposta do FAQ do Hootsuite sobre publicação automática (não abriu).

## Histórico de correções

- 16/10: a tabela inicial citava OwlyWriter (Hootsuite), Predis como gerador de posts e Blotato como
  gerador com agendador. Hoje: Wisdom (agente), gerador de anúncios e API com MCP.
- 16/10: o teste inicial do pipeline rodou em branch defasada. Refeito na `main`. A conclusão
  "diferencial só no papel" foi retirada.

## Fontes

- [Instagram Platform: App Review](https://developers.facebook.com/docs/instagram-platform/app-review)
- [Instagram content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
- [Meta Business Verification (360dialog)](https://docs.360dialog.com/partner/waba-management/business-verification)
- [LinkedIn Community Management app review](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review?view=li-lms-2023-11)
- [X API pay-per-use (Medianama)](https://www.medianama.com/2026/02/223-x-developer-api-pricing-pay-per-use-model/)
- [Ayrshare pricing](https://www.ayrshare.com/pricing)
- [Postiz vs Buffer](https://dev.to/vikasprogrammer/buffer-wanted-100mo-so-i-self-host-postiz-for-15-dfa)
- [Comparativo de preços de schedulers](https://superframeworks.com/articles/best-social-media-scheduling-tools)
- [Rejeições no App Review](https://singhamandeep.com/?p=951)
- [Pagamentos para SaaS no Brasil (TabNews)](https://www.tabnews.com.br/RBFraphael/pra-bolha-saas-como-voces-fazem-a-parte-de-pagamento)
