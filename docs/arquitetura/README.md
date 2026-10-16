# Arquitetura SaaS no Google Cloud (proposta, 16/10/2026)

> Decidido: [ADR 0006](../adr/0006-google-cloud-como-plataforma.md) (Google Cloud) e ADR 0007 (três
> papéis de conta, na PR do banco portável). O resto é proposta e vira SPEC quando for construído.
> Os desenhos estão em [`gcp/`](gcp/) (SVG editável e PNG). Preço de borda, KMS e instância
> quente vem da minha memória dos catálogos: **não verificado**.

| Desenho | O que mostra |
| --- | --- |
| [01 mapa](gcp/01-mapa.png) | quem fala com quem |
| [02 segurança](gcp/02-seguranca.png) | portões de cada rota de entrada |
| [03 publicação](gcp/03-publicacao.png) | um post do despertador ao aviso |
| [04 contas e papéis](gcp/04-contas-e-papeis.png) | PF e PJ, quem pode o quê |
| [05 mapa de telas](gcp/05-mapa-de-telas.png) | cada tela por papel ([arquitetura de usuário](usuario.md)) |
| [06 jornadas](gcp/06-jornadas.png) | cadastro, convite e login |
| [07 ciclo por papel](gcp/07-ciclo-por-papel.png) | etapas do conteúdo e quem recebe cada aviso |
| [08 ultra admin](gcp/08-ultra-admin.png) | como só o Matheus entra e o que o console faz ([ultra-admin.md](ultra-admin.md)) |

## Contas: PF e PJ no mesmo modelo

- Uma conta (`tenants`) com `kind` = `pessoa` ou `empresa`. Mesmas tabelas, mesmo RLS, mesmo código.
- O **plano** define limites (assentos, redes, posts e gerações por mês). O **papel** define ações.
  Nunca um `if pessoa` no código: a diferença mora no plano.
- PF tem 1 assento e a pessoa é a administradora. Subir para um plano com equipe só muda limites.
- Uma pessoa pode estar em várias contas (agência, freelancer), como já diz o ADR 0005.
- Cobrança no Asaas com CPF ou CNPJ validado na entrada.

## Papéis (decidido em 16/10: três níveis, sem dono)

| Hoje (0012) | Proposta | Quem é | Resumo |
| --- | --- | --- | --- |
| owner + admin | **Administrador** | sócio ou coordenador | tudo da conta: equipe, redes, marca, aprovação, pausa, plano, cobrança, exportar, excluir, audit log |
| editor | **Criador** | marketing ou quem produz | cria, edita e gera com IA; pede revisão; aprova só se o administrador liberar |
| viewer | **Leitor** | revisor, cliente, sócio que opina | lê, dá parecer (aprovo ou ajustar, com comentário) e feedback; o parecer não publica |

Exemplo: num escritório de engenharia, o sócio ou o coordenador é administrador, a equipe de
marketing é criadora, e quem só opina sobre o post é leitor.

A matriz completa está no desenho 04. Regras que o banco garante e o CI testa:

1. Toda conta tem pelo menos um administrador: o último não sai nem é rebaixado.
2. Excluir a conta pede MFA e o nome da conta, e avisa todos os administradores.
3. Administrador entra com MFA.
4. Mudança de papel, rede ou cobrança vai para o audit log e avisa os administradores por e-mail.
5. Limite do plano é checado no servidor, nunca só na tela.
6. O ultra admin não é papel de conta: console próprio, só do Matheus ([ultra-admin.md](ultra-admin.md)).

O "responsável pela cobrança" é um campo da conta (qual administrador recebe a nota e o aviso de
pagamento), não um papel.

Implementação: permissões numa tabela fixa (`role_permissions`, semeada por migration) e um
helper `app.can(tenant, 'post.approve')` usado pelo RLS e pela API. Mudar a matriz é uma
migration, testada no `rls_test.sql`.

## O que mudou em relação ao primeiro desenho

| Mudança | Por quê |
| --- | --- |
| **Borda:** Load Balancer, Cloud Armor e Cloud CDN | domínio próprio em São Paulo, WAF, limite por IP, estáticos mais rápidos. Custo fixo a mais (~US$ 20 a 25 por mês, não verificado) |
| **Cloud Tasks** entre a agenda e os workers | um task por post, fila por rede: uma conta ou rede lenta não segura as outras; o tick não estoura tempo com muitas contas |
| **Geração com IA assíncrona** | a tela não espera o Gemini; o worker gera e avisa |
| **Tokens das redes cifrados no Cloud SQL com Cloud KMS** | Secret Manager por conta não escala nem em custo nem em cota; KMS mantém a chave fora do banco |
| **Mídia privada com URL assinada** | rascunho de cliente não fica público; a Meta recebe uma URL que expira (validar no spike) |
| **Webhook do Asaas** com token conferido em tempo constante e evento idempotente | cobrança é o caminho que mais atrai ataque e repetição |
| **Ledger de uso por conta** (tokens de LLM, posts, custo do X) | limite do plano e custo por cliente antes de definir preço |
| **Staging e prod em projetos separados**, mesmo Terraform | erro em staging não toca dado de cliente |
| **Instância quente** na plataforma em prod | sem cold start na tela |
| **Telegram removido** | avisos viram notificação no app e e-mail; alerta operacional vai do Cloud Monitoring para o e-mail da equipe |

## Remoção do Telegram

O Telegram tem dois papéis hoje:

1. **Aprovação por botão** (`src/telegram.js` com `sendApprovalRequest`, `fetchDecisions`;
   `src/resolve.js`; `resolve.yml`). A inbox da plataforma já substitui. **Sai inteiro.**
2. **Avisos** (`notify()`, cerca de 30 chamadas). Vira `notify(tenantId, evento)` gravando numa
   tabela `notifications` (lida pela tela) e mandando e-mail só no que é crítico: falha de
   publicação, token vencendo, relatório semanal.

Arquivos que mudam: `src/telegram.js`, `src/index.js`, `src/resolve.js`, `src/reel.js`,
`src/refresh-tokens.js`, `src/metrics.js`, `src/repurpose.js`, `src/engage.js`,
`src/utils/funnel.js`, `platform/src/lib/telegram.ts`, `platform/src/lib/publish.ts`,
`platform/src/lib/scheduling.ts`, `platform/src/app/api/pause/route.ts`,
`tests/telegram.test.js`, `tests/cockpit.test.js`, os workflows `post`, `resolve`,
`refresh-tokens`, `token-health-check`, `weekly-report` e `ci`, `package.json` (sai
`node-telegram-bot-api`, o que também resolve a dependência crítica `request` citada na SPEC 006),
`.env.example`, `platform/.env.local.example`, `README.md`, `SETUP.md` e `platform/README.md`.

Fora do código: revogar o bot no BotFather depois do merge.

## Em aberto

- Para a advogada: direito de arrependimento de 7 dias (CDC) na assinatura de PF, e termos
  diferentes para PF e PJ.
- O que decidir e construir antes do Google Cloud: [sem-google.md](sem-google.md).
