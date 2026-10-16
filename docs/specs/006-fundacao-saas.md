# SPEC 006: fundação do SaaS

- **Status:** F1 entregue (#22); F2 parcial: escopo por tenant, validação de entrada, erros e log, contrato do tenant (0013), exportação. Falta o login por usuário (precisa de protótipo).
- **Data:** 2026-10-16
- **Depende de:** [ADR 0002](../adr/0002-plataforma-como-produto-proprio.md), [ADR 0003](../adr/0003-migrations-automaticas-no-merge.md), [ADR 0004](../adr/0004-construir-o-saas-sem-cnpj-validando-com-a-pilar.md) (construir sem CNPJ, gates antes de cobrar), [ADR 0005](../adr/0005-tenancy-e-login-por-usuario.md)
- **Referência:** esteira de engenharia pessoal (`~/.claude/standards/ESTEIRA.md`) e o que já foi
  aprendido construindo a Pilar (cofre, `personal/features/pilar/`)

## Problema

A plataforma deixou de ser o cockpit da Pilar e virou produto (ADR 0002), mas a fundação ainda
é de ferramenta de uma pessoa: um login por senha, o banco isolado só por "ninguém além da
service role entra", e nada de cadastro, cobrança, observabilidade ou operação. A Pilar passou
por cada um desses degraus e deixou registrado o que custou caro fazer tarde. Esta spec ordena
esses degraus para este produto, na fase certa, sem construir antes da hora.

## Não-objetivos

- Escolher nome, marca e posicionamento. A spec usa "o produto"; o nome passa pela due diligence
  (marca, domínio, handles) antes de aparecer em código ou tela.
- SSO, API pública, permissão granular além de papel, tour guiado: só depois do primeiro
  cliente pagante de peso (fase 6 do roteiro).
- Trocar de stack. Next + Supabase + Vercel ficam.

## Fases

Cada item vira PR própria. Item de tela só começa com protótipo aprovado no Claude Design.

O ADR 0004 manda construir agora e só abrir empresa e cobrar depois dos gates (contrato com a
Labrynth, titularidade, caso Pilar, demanda dos pilotos, sustentabilidade). Por isso:

- **F1 e F2 andam já.** São fundação e servem aos pilotos (que o Matheus opera conectando a
  conta do piloto em modo dev): cada piloto é um tenant, com login próprio para aprovar.
- **F3 em diante espera o gate.** Conexão pública de rede, cobrança e marca estão fora de escopo
  até lá. A F3 só tem parte antecipável sem gate: config do tenant no banco e onboarding interno,
  necessários para operar 3 pilotos sem editar código.

### F1. Fundação de dado e pipeline (dia 1, esta PR)

| Item | Entrega | Verificação |
|---|---|---|
| Dono de cada linha | tabela `tenants`, `pilar` semeada, FK de `tenant_id` em todas as tabelas de dado | migration 0012 aplicada 2x no CI |
| Quem pertence a quem | `tenant_members` ligada ao Supabase Auth, papéis owner/admin/editor/viewer | idem |
| Isolamento no banco | policies por tenant em todas as tabelas; editorial = editor escreve, resto só lê; helpers em schema `app` (não vira RPC) | `supabase/ci/rls_test.sql` roda como `authenticated` com JWT, testado contra Postgres puro, Supabase local e PostgREST com usuário real |
| Catraca de catálogo | o teste reprova tabela sem RLS, tabela com `tenant_id` sem policy, grant para `anon` e SECURITY DEFINER executável por `anon` | 4 mutações provocadas, as 4 reprovadas |
| Banco novo | grant explícito à `service_role` em todas as tabelas (projeto Supabase novo não concede mais) | REST com service key lê `posts` num Supabase recém-criado |
| Cron | `/api/cron/publish-due` recusa sem `CRON_SECRET`, só aceita `Authorization: Bearer`, comparação em tempo constante | build de produção: 401 sem header, com `?key=`, com bearer errado e sem segredo no servidor |
| Cabeçalhos | CSP, `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy, sem `X-Powered-By` | headers conferidos no build; login hidrata sem violação de CSP no console |
| Saúde | `GET /api/health` público, 200/503 conforme o banco, sem detalhe do erro | 503 com banco fora |
| CI | varredura de segredo nos commits novos (gitleaks fixado por checksum), `npm audit` crítico da plataforma, job agregado `CI ok` | actionlint limpo |
| Dependências | `npm audit fix` na raiz e na plataforma (Next 15.5.28) | 251 testes, typecheck e build verdes |

### F2. Login por usuário e tenant na sessão (antes do 2º tenant)

ADR 0005 detalha. Estado de cada item:

1. [ ] Supabase Auth (email + senha e link mágico) substitui a senha única. Sessão por cookie
   do `@supabase/ssr`; o middleware renova a sessão. **Espera protótipo das telas.**
2. [~] Acesso de tela e de API pelo cliente do usuário (RLS decide). Feito o escopo por tenant
   no servidor (`tenantDb`, com teste que barra `db()` cru); falta trocar o cliente quando o
   login por usuário entrar. A service role fica só no cron, nos jobs e em operações de sistema.
3. [x] Tenant ativo vem da sessão (assinado no cookie), nunca do corpo da requisição.
4. [x] Contract da 0003: sem `default 'pilar'` em `tenant_id` (0013). Tenant novo nasce pausado.
5. [x] Validação por parser em todas as rotas de API (`route-input.ts`).
6. [x] Erro de API: mensagem de domínio para o usuário, detalhe técnico só no log estruturado.
   **Pendente:** rastreador de erro (Sentry), precisa de conta e DSN.
7. [ ] Rate limit: o login por senha única ainda não tem (o do Supabase Auth cobre depois do
   item 1). Nas rotas que chamam o modelo (rascunho de engajamento) também falta.
8. [x] Exportação dos dados do tenant (`/api/export`, `/settings`). **Pendente:** exclusão.
9. [x] Criar tenant por comando (`npm run tenant:create`) e runbook de operação.

Telas novas (protótipo antes): login, cadastro, esqueci a senha, convite aceito, seletor de
tenant quando o usuário tem mais de um.

### F3. Cadastro self-serve e onboarding (gate do ADR 0004)

- Cadastro cria o tenant e o owner por função de servidor; tenant nunca vem de metadata do
  cliente.
- Onboarding guiado com progresso **derivado do dado** (não persistido): conectar a 1ª rede,
  descrever o negócio (nicho, ICP, voz), aprovar a 1ª ideia.
- Config do tenant sai de `src/tenant.js` para o banco (`tenant_profiles`): taxonomia, persona,
  voz, guardrails, marca. Seed por trigger AFTER INSERT em `tenants`, não só backfill.
- Conexão de rede por OAuth dentro do app (Instagram via Meta, LinkedIn). Tokens por tenant,
  cifrados (Vault), com rotação. Gargalo é app review da Meta e LinkedIn com PJ: começar o
  processo cedo, é prazo de terceiro.
- Email transacional (convite, reset, aviso de token vencendo) com templates próprios.
- Termos de uso e política de privacidade publicados. DPA do provedor de LLM conferido antes de
  mandar dado de cliente.

### F4. Cobrança (gate do ADR 0004)

- Provedor: Asaas, como na Pilar (Pix + boleto + cartão, PJ brasileira). Checkout, webhook com
  assinatura verificada em tempo constante e anti-replay, idempotência por constraint.
- Entitlement separado de billing e de feature flag: o plano diz o que o tenant pode, o gate lê
  o entitlement.
- Trial com expiração registrada num agendador de verdade, com avisos 7/3/1 dias.
- Medição de uso: ledger de tokens de LLM e de posts publicados por tenant (o X cobra por post).
  Custo por tenant visível antes de definir preço.

### F5. Operação (antes de ter mais de um punhado de clientes)

- Error tracking (Sentry) no app e nos jobs, com release marcada no deploy.
- Logging estruturado com scrub de dado pessoal.
- Painel super admin mínimo + impersonation auditado + audit log das ações administrativas.
- Alertas operacionais (avisos da conta em `notifications` desde a SPEC 007; falta o e-mail e o
  alerta de job parado).
- Exportação e exclusão de dado do tenant (LGPD).
- Backup: plano pago do Supabase ou dump agendado; restore **executado**, não só documentado.
- Staging separado de produção, com smoke antes de promover.
- Feito: o Telegram saiu inteiro na SPEC 007 (a lib que trazia o `request` já tinha saído).
  Falta endurecer o `npm audit` da raiz para crítico.

### F6. Diferencial (com tração)

Blueprints de nicho (perfil, taxonomia e exemplos prontos por segmento), agentes de tendência
do nicho, analytics por campanha e funil, calibração do judge contra resultado real.

## Briefing para o Claude Design (F2/F3)

Produto: plataforma que gera, aprova e publica posts de Instagram, LinkedIn e X para empresas
B2B, aprendendo com o que o cliente aprova e edita. Público: dono ou responsável de marketing de
empresa pequena, no desktop no dia a dia e no celular para aprovar.

Telas, cada uma em desktop e mobile:

1. **Entrar**: email + senha, "Receber link por email", "Esqueci a senha". Estados: padrão,
   enviando, erro de credencial, link enviado.
2. **Criar conta**: nome, email, senha, nome da empresa. Estados: padrão, enviando, email já
   usado, sucesso (confirme o email).
3. **Aceitar convite**: "Fulano convidou você para Empresa X como editor". Estados: válido,
   expirado, já aceito.
4. **Onboarding**: checklist lateral com 3 passos (conectar rede, contar sobre o negócio,
   aprovar a primeira ideia), passo atual em destaque, progresso derivado. Estados: vazio,
   parcial, completo.
5. **Seletor de empresa** no topo, só quando o usuário pertence a mais de uma.

Restrições: microcopy em português, voz ativa, sentence case, botão com verbo; erro diz o que
houve e o próximo passo; sem emoji decorativo. Reaproveitar a linguagem visual atual do
cockpit (fundo escuro, acento roxo) até a marca existir. Dado seed: empresa "Pilar", usuário
"Matheus", convite para "Escritório Exemplo".

## Critérios de aceite da F1

- [x] Migrations 0001 a 0012 aplicam duas vezes num Postgres limpo e num Supabase local.
- [x] Usuário de um tenant não lê nem grava dado de outro; viewer não grava; logado sem tenant
      não vê nada; `anon` não lê tabela nenhuma (teste SQL e PostgREST).
- [x] O teste de RLS reprova quando a policy é aberta, quando `anon` ganha grant, quando um
      helper SECURITY DEFINER fica executável e quando nasce tabela sem RLS.
- [x] Cron recusa chamada sem segredo configurado e sem `Authorization: Bearer`.
- [x] Health responde 503 com o banco fora.
- [x] `CI ok` é o único check a exigir na proteção da `main`.

## Pendências fora do código

- Projeto Supabase novo (o antigo não existe mais) em `sa-east-1`, numa conta separada da Pilar
  e da Trinity (mesma lógica da conta Meta no ADR 0004), e o segredo `SUPABASE_DB_URL` no
  environment `Production`.
- Proteção da `main` exigindo o check `CI ok`.
- Repo público ou privado: com código de produto pago, privado é o padrão.
