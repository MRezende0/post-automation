# SPEC 008: banco portável e três papéis de conta

- **Status:** implementada (dado e RLS); login e telas ficam para depois
- **Data:** 2026-10-16
- **Depende de:** [ADR 0005](../adr/0005-tenancy-e-login-por-usuario.md),
  [ADR 0007](../adr/0007-tres-papeis-de-conta.md), plano em
  [`docs/arquitetura/sem-google.md`](../arquitetura/sem-google.md) (itens 1 e 2)

## Problema

1. As policies e helpers liam o usuário de `auth.uid()` e `tenant_members` apontava para
   `auth.users`. Os dois só existem no Supabase; no Cloud SQL o banco não sobe sem eles.
2. Os papéis eram quatro (`owner`, `admin`, `editor`, `viewer`) e o acesso era "edita tudo ou lê
   tudo". O produto precisa de três papéis com permissões diferentes por área.

## Entrega (migration 0015)

| Item | Como |
| --- | --- |
| Pessoa própria | tabela `users` (id, e-mail em minúsculas, `idp_uid`), backfill de quem já está no `auth.users` |
| Usuário da requisição | `app.current_user_id()`: `app.user_id`, senão o `sub` do JWT do Supabase |
| Papéis | `admin`, `creator`, `viewer`; `owner` vira `admin`, `editor` vira `creator` |
| Matriz | `role_permissions` com 14 permissões; `app.can(conta, permissão)` |
| Criador aprova | `tenants.creator_can_approve` (padrão desligado) libera `content.approve` ao criador |
| Escrita por área | agenda (`scheduled_posts`) pede `content.approve`; pausa e grade, `publishing.manage`; regras de estilo, `brand.manage`; feedback, `content.feedback` (todos); o resto editorial, `content.edit` |
| Último administrador | trigger em `tenant_members` barra remover ou rebaixar o último `admin`; a cascata de conta apagada passa |
| Pessoas visíveis | cada um vê a si e aos colegas das suas contas |

## Fora do escopo

- Login por pessoa (Identity Platform no emulador) e a tela de equipe: itens 3 e 6 do plano.
- Convites, pareceres em tabela própria (`reviews`) e avisos por papel.
- `platform_admins` e o console do ultra admin.

## Critérios de aceite

- [x] Migrations 0001 a 0015 aplicam duas vezes num Postgres 17 limpo; o schema aceita o que o
      código grava.
- [x] O teste de RLS cobre admin, criador e leitor pelo `app.user_id` e um leitor pelo JWT do
      Supabase, mais logado sem conta.
- [x] Seis mutações provadas e reprovadas: criador com marca, sem a trava do último admin, leitor
      editando, policy com `auth.uid()`, `current_user_id` ignorando `app.user_id`, criador aprovando
      sem a conta liberar.
- [x] Travas de catálogo: policy, função ou FK que dependa do schema `auth` reprova.
- [x] Banco com `owner` e `editor` e pessoas no `auth.users` migra para `admin` e `creator`, com
      `users` preenchida.
- [x] Suíte de testes verde.
