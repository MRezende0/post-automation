# ADR 0005: tenant no banco, isolamento por RLS e login por usuário

- **Status:** aceito (parte de dado implementada na 0012; login na F2 da SPEC 006)
- **Data:** 2026-10-16
- **Substitui:** item 4 do [ADR 0002](0002-plataforma-como-produto-proprio.md) (login por tenant
  vem antes do 2º cliente, porque cada piloto do [ADR 0004](0004-construir-o-saas-sem-cnpj-validando-com-a-pilar.md) já é um tenant)
- **Specs que dependem:** [SPEC 006](../specs/006-fundacao-saas.md)

## Contexto

Desde a 0003 toda tabela tem `tenant_id`, mas o isolamento depende de o código lembrar de
filtrar: a plataforma e os jobs usam a service role, que ignora RLS. O ADR 0002 adiou login por
tenant "até o 2º cliente". Na Pilar, o que mais custou foi exatamente retrofit de isolamento:
RPC SECURITY DEFINER sem checagem de tenant, grant indevido a `anon`, coluna de tenant sem
preenchimento automático. Fazer agora, com um tenant só e pouco dado, é barato.

## Decisão

1. **Tenant é linha no banco** (`tenants`), e todo `tenant_id` tem FK para ele.
2. **Pertencer é `tenant_members`** (tenant, usuário do Supabase Auth, papel). Um usuário pode
   pertencer a mais de um tenant (agência atende vários clientes), diferente da Pilar, que é uma
   empresa por usuário.
3. **Papéis:** owner, admin, editor (aprovam, agendam, dão feedback) e viewer (só lê). O que só
   os jobs gravam (posts, métricas, snapshots, funil) é leitura para qualquer papel.
4. **O banco decide o acesso.** Policies por tenant em toda tabela de dado, com helpers
   `app.is_tenant_member` e `app.can_edit_tenant`: SECURITY DEFINER, `search_path` vazio, usuário
   sempre de `auth.uid()`, no schema `app`, que o PostgREST não expõe. Funções novas nascem sem
   EXECUTE para PUBLIC.
5. **Login por usuário com Supabase Auth** (email e senha, link mágico). A senha única sai. A
   service role fica restrita a cron, jobs e operações de sistema (criar tenant, convidar).
6. **Tenant ativo vem da sessão**, nunca do corpo da requisição nem de metadata do cliente.
7. **Teste de RLS no CI** roda como `authenticated` com JWT simulado e reprova tabela nova sem
   RLS ou sem policy, grant para `anon` e SECURITY DEFINER aberto. Regra nova de banco entra
   nesse teste, não num checklist.

## Consequências

- Tabela nova com `tenant_id` precisa entrar na lista da policy (o teste reprova se esquecer).
- Enquanto a plataforma usa a service role (até a F2), as policies estão prontas mas não são o
  que protege a tela; o que protege é o login atual.
- O default `'pilar'` de `tenant_id` continua até a F2 tirar (contract). Até lá, um insert que
  esquece o tenant cai na Pilar; depois, falha.
- Cadastro aberto no Supabase Auth não dá acesso a nada: usuário sem membership não vê linha.
