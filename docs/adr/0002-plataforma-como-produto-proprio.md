# ADR 0002: a plataforma de posts é um produto próprio

- **Status:** proposto
- **Data:** 2026-10-15
- **Specs que dependem:** [SPEC 003](../specs/003-ideia-reaproveitamento-e-feedback.md)

## Contexto

A interface web deste repo (`platform/`) nasceu como cockpit interno da Pilar para aprovar e
agendar posts. O plano é a Pilar continuar usando a automação, mas como cliente de um produto
separado que pode ser vendido depois para outros escritórios e empresas.

## Decisão

1. A plataforma deste repo é o produto. A Pilar não ganha uma área de posts dentro do app
   dela: ganha um link (redirecionamento) que abre esta plataforma.
2. A Pilar é o tenant `pilar`. Todo dado novo nasce com `tenant_id`, como já é desde a 0003.
3. Preferência aprendida (regras de estilo, feedback, escolhas) é sempre por tenant. Nada que
   um tenant ensina vaza para outro.
4. Login por tenant, cobrança e cadastro self-service ficam para quando houver o 2º cliente.
   Até lá, a autenticação atual (`AUTH_SECRET`, um usuário) continua.

## Consequências

- Toda tela nova filtra por tenant, mesmo com um tenant só, para não reescrever depois.
- Copy e marca da plataforma não podem assumir "Pilar" no código; vêm do tenant.
- Antes do 2º tenant: rodar a 0004 (índice legado de pendência), login por tenant e RLS por
  tenant em vez de só service role.
