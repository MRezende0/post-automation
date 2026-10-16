# ADR 0006: Google Cloud como plataforma do produto

- **Status:** aceito
- **Data:** 2026-10-16
- **Substitui:** o não-objetivo "Trocar de stack. Next + Supabase + Vercel ficam" da
  [SPEC 006](../specs/006-fundacao-saas.md)
- **Análise:** [viabilidade de nuvem](../analises/2026-10-16-viabilidade-cloud.md) e
  [arquitetura SaaS](../arquitetura/README.md)

## Contexto

O produto vai virar SaaS vendido a pessoa física e a empresa. Hoje roda em Supabase, Vercel e
GitHub Actions, e nada está em produção: o banco antigo sumiu, os workflows estão desligados e a
Vercel gratuita trava por limite de builds. A análise mostrou que, nesta escala, a diferença de
custo entre Supabase, Google Cloud e AWS é de US$ 0 a 10 por mês, e que trocar custa semanas de
código. O Matheus escolheu o Google Cloud para aprender a operar o ecossistema e ter um só
fornecedor para banco, filas, IA (Gemini via Vertex) e identidade.

## Decisão

1. **Google Cloud, região São Paulo**, um projeto por ambiente (prod e staging), com Terraform.
2. **Cloud SQL (Postgres)** no lugar do banco do Supabase, com o RLS por conta mantido.
3. **Identity Platform** no lugar do Supabase Auth; a pessoa mora na nossa tabela `users`
   ([ADR 0007](0007-tres-papeis-de-conta.md)).
4. **Cloud Run** para a plataforma e os workers, **Cloud Tasks** com fila por rede,
   **Cloud Scheduler** no lugar do Vercel Cron e do GitHub Actions.
5. **Cloud Storage** privado com URL assinada, **Cloud KMS** para os tokens das redes,
   **Secret Manager** para os segredos da plataforma.
6. **Borda com Load Balancer, Cloud Armor e Cloud CDN** quando houver domínio.
7. A conta do Google Cloud é pessoal ou da BEZ, nunca da Labrynth (titularidade, ADR 0004).

## Consequências

- Tudo que não depende de conta no Google é construído antes, localmente
  ([sem-google.md](../arquitetura/sem-google.md)): banco portável, papéis, login no emulador,
  camada de dados sem `supabase-js`, Dockerfiles e Terraform escritos.
- O CI de migrations em produção (`supabase db push`, ADR 0003) é trocado por migrations aplicadas
  no Cloud SQL quando o projeto existir; até lá ele segue falhando por falta do segredo.
- O Google Cloud não tem teto de gasto: orçamento com alerta é o primeiro recurso criado.
- Preços por região (São Paulo) e a disponibilidade de domínio no Cloud Run ainda precisam ser
  conferidos.
