# ADR 0007: três papéis de conta e identidade fora do Supabase Auth

- **Status:** aceito
- **Data:** 2026-10-16
- **Substitui:** item 3 do [ADR 0005](0005-tenancy-e-login-por-usuario.md) (papéis owner, admin,
  editor, viewer) e a amarra de `tenant_members` ao `auth.users`
- **Specs que dependem:** [SPEC 008](../specs/008-banco-portavel-e-papeis.md)
- **Contexto de produto:** [arquitetura SaaS](../arquitetura/README.md) e
  [arquitetura de usuário](../arquitetura/usuario.md)

## Contexto

O produto vai ser vendido a pessoa física e a empresa. Quem contrata é, por exemplo, um escritório
de engenharia: o sócio ou o coordenador manda, a equipe de marketing produz, e há quem só opina.
Um papel de "dono" separado do administrador não resolve nenhum caso desses e cria regra a mais
(transferência, um por conta). Além disso, o projeto vai para o Google Cloud (Cloud SQL e
Identity Platform), onde não existe `auth.users` nem `auth.uid()`.

## Decisão

1. **Três papéis por conta:** `admin` (tudo da conta, inclusive cobrança, exportar e excluir),
   `creator` (cria, edita, gera com IA e pede revisão) e `viewer` (lê, dá parecer e feedback; na
   tela, "Leitor"). Sem dono.
2. **O criador aprova só se a conta liberar** (`tenants.creator_can_approve`, padrão desligado).
3. **A matriz mora no banco** (`role_permissions`), e as policies perguntam `app.can(conta,
   permissão)`. Mudar a matriz é uma migration, testada no `rls_test.sql`.
4. **Toda conta mantém pelo menos um administrador:** o último não sai nem é rebaixado.
5. **A pessoa mora em `users`, nossa**, com o id do provedor de login em `idp_uid`. O usuário da
   requisição vem de `app.current_user_id()`: primeiro `app.user_id` (definido pelo nosso
   servidor por transação), depois o `sub` do JWT do Supabase. O mesmo banco funciona no Supabase
   e num Postgres puro.
6. **O ultra admin não é papel de conta.** Fica fora desta matriz, numa tabela própria
   ([ultra-admin.md](../arquitetura/ultra-admin.md)).

## Consequências

- `owner` vira `admin` e `editor` vira `creator` na 0015; quem já existia no `auth.users` ganha a
  linha em `users` com o mesmo id.
- O leitor passa a gravar feedback (parecer), o que antes era vedado ao `viewer`.
- Pausa e grade de horários, marca e regras e agenda passam a exigir a permissão específica, não
  só "editar".
- Conta pode ficar sem administrador só quando é apagada inteira (cascata).
- Login com Supabase Auth exige criar a linha em `users` no cadastro; com o Identity Platform, o
  servidor acha a pessoa por `idp_uid` e define `app.user_id`.
