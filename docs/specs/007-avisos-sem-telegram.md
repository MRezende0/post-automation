# SPEC 007: avisos da conta no lugar do Telegram

- **Status:** implementada (dado e escrita); tela e e-mail ficam para depois
- **Data:** 2026-10-16
- **Depende de:** [ADR 0005](../adr/0005-tenancy-e-login-por-usuario.md) (tenant e RLS),
  [SPEC 006](006-fundacao-saas.md) (F3 traz e-mail, F5 alertas operacionais),
  proposta de arquitetura em [`docs/arquitetura/`](../arquitetura/README.md)

## Problema

O Telegram era um chat só, do Matheus. Num SaaS com várias contas e várias pessoas por conta, ele
não serve: não separa tenant, não sabe quem é administrador, guarda dado de cliente fora do
produto e exige bot e segredo por instalação. Ele fazia duas coisas:

1. **Aprovação por botão** (legenda, arte, regenerar, rejeitar, motivo por mensagem). A inbox da
   plataforma já faz tudo isso.
2. **Avisos** (publicou, falhou, post pronto, relatório semanal, tokens), cerca de 30 chamadas.

## Decisão

1. A aprovação por Telegram sai inteira. `src/resolve.js` fica só com os pedidos de nova versão
   feitos na tela da ideia.
2. Todo aviso vira uma linha em `notifications` do tenant (migration 0014). Jobs e plataforma
   gravam pela service role; membro do tenant só lê (RLS, testado no CI).
3. O aviso é texto puro, sem HTML; quem mostra escapa. `link` só aceita caminho da plataforma.
4. Gravar aviso é best-effort: falha vai para o log e nunca derruba publicação, agendamento ou job.
5. Sem banco (`STATE_BACKEND=yaml`) ou em `DRY_RUN`, o aviso sai só no log.
6. As colunas do fluxo do Telegram saem de `pending_approvals` (`message_ids`,
   `keyboard_message_id`, `reason_requested_at`), e pendências presas em `awaiting_art` ou
   `awaiting_reason` voltam para `awaiting_decision`.
7. Um teste reprova o CI se código, script, workflow ou dependência voltar a falar com o Telegram.

## Tipos de aviso

| `kind` | Nível | Quem grava |
| --- | --- | --- |
| `pending.ready` | info | geração: post pronto para aprovar |
| `pending.expired`, `pending.blocking` | info | geração |
| `pending.rejected` | info | plataforma |
| `generation.channel_failed` | warning | geração: uma rede ficou fora da ideia |
| `generation.failed`, `job.failed` | error | job que caiu |
| `rework.ready` / `rework.failed` | info / warning | resolve |
| `schedule.created` | info | plataforma |
| `publish.ok` | info | plataforma (ou geração sem aprovação) |
| `publish.retry` / `publish.failed` | warning / error | plataforma |
| `publish.partial`, `publish.link_failed`, `publish.unrecorded` | warning | plataforma |
| `publishing.paused` / `publishing.resumed` | warning / info | plataforma |
| `tokens.health` | info, warning ou error | refresh-tokens |
| `report.weekly` | info | metrics |
| `reel.script`, `reel.failed`, `repurpose.queued` | info / warning | jobs de conteúdo |

## Fora do escopo

- **Tela de avisos** (sino, lista, lido e não lido por pessoa): tela nova, nasce de protótipo no
  Claude Design. Junto vem a tabela de leitura por usuário.
- **E-mail** para os avisos críticos (`publish.failed`, `tokens.health` com erro,
  `report.weekly`): SPEC 006 F3, com o provedor de e-mail.
- **Para quem vai cada aviso** (só administrador, todos): entra com os papéis da proposta de
  arquitetura.
- `npm run engage` passa a imprimir os comentários no terminal; o caminho principal já é a área
  Engajamento da plataforma.

## Critérios de aceite

- [x] Nenhum arquivo em `src/`, `platform/src/`, `scripts/` e `.github/workflows/` fala com o
      Telegram, e nenhum `package.json` depende dele (teste com mutação provada).
- [x] Migration 0014 aplica duas vezes num Postgres limpo; o schema aceita o insert de aviso.
- [x] Membro lê só os avisos do próprio tenant, não grava aviso, e logado sem tenant não vê nada
      (`rls_test.sql`, com mutação provada).
- [x] `notifications` entra na exportação do tenant (LGPD).
- [x] Aviso que falha ao gravar não derruba quem chamou (teste).
- [x] Suíte, typecheck e build da plataforma verdes.

## Depois do merge

- Revogar o bot no BotFather e apagar os secrets `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` do
  repositório e da Vercel.
- Tirar as duas variáveis dos `.env` locais.
