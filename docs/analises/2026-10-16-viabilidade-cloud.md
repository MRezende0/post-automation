# Viabilidade de nuvem: Supabase, Google Cloud, AWS e outros (16/10/2026)

> Pesquisa e análise, não decisão. Se a decisão sair daqui, vira ADR 0006.
> Contexto: [ADR 0005](../adr/0005-tenancy-e-login-por-usuario.md) e [SPEC 006](../specs/006-fundacao-saas.md),
> que hoje assumem Next + Supabase + Vercel.
> Preços vêm de guias de terceiros (jul a set/2026) e de páginas dos fabricantes que a busca
> devolveu. **Nenhum número foi conferido na calculadora oficial, e os de São Paulo
> (`southamerica-east1` e `sa-east-1`) não foram achados.** Marquei o que é estimativa minha.
> A conversa do ChatGPT não abriu (HTTP 403), então esta análise **não foi cruzada com ela**.

## Veredito

**Não migrar o banco para o Google Cloud agora. Usar o Google Cloud primeiro para jobs, agenda e
LLM, e deixar a troca do banco atrás de um gate.**

1. **O argumento de custo não se sustenta nesta escala.** O Supabase Pro (US$ 25) já traz banco,
   login, API REST e storage. O equivalente no Google Cloud monta quatro serviços e o banco sozinho
   custa o mesmo que o Supabase inteiro.
2. **Hoje é o momento mais barato de trocar, mas a troca ainda custa semanas.** Não existe banco de
   produção (o projeto antigo sumiu, o novo ainda não foi criado) e não há dado a migrar. Mesmo
   assim, a F2 da SPEC 006 foi desenhada sobre Supabase Auth + RLS com `auth.uid()`.
3. **O custo que importa neste produto não é o banco.** É Gemini, imagem e vídeo, e o X (US$ 0,015
   por post, US$ 0,20 com link). Um post com link no X custa mais que um dia inteiro de Cloud SQL
   pequeno. O ADR 0004 já registra que o custo por campanha **não foi medido**: medir isso vale
   mais que escolher nuvem.
4. **O que o Google Cloud faz melhor aqui não exige trocar o banco:** Cloud Run Jobs e Cloud
   Scheduler no lugar do GitHub Actions e do Vercel Cron (a Vercel Hobby está travando em
   "rate limited"), e Vertex AI para o Gemini. Isso funciona falando com o Supabase por fora.

## O que o projeto tem hoje (medido no repo)

| Item | Valor | Leitura |
| --- | --- | --- |
| Migrations | 12 arquivos, 772 linhas de SQL | SQL padrão, em grande parte portável |
| Chamadas `.from('tabela')` do supabase-js | 101 em 19 arquivos | é onde o acoplamento mora |
| Storage | 1 uso (`src/utils/storage.js`, bucket `post-images`) | troca trivial |
| Dependência de Auth | FK para `auth.users` e `auth.uid()` nos helpers `app.is_tenant_member` e `app.can_edit_tenant` (0012) | ponto de reescrita |
| Papéis `anon`, `authenticated`, `service_role` | usados nos `revoke`/`grant` de quase toda migration | não existem em Postgres puro |
| CI de RLS | `supabase/ci/rls_test.sql` já roda contra Postgres puro com `bootstrap.sql` | reduz o risco de portar |
| Produção | nenhum banco no ar, workflows desligados desde junho | sem dado para migrar |

## Estimativa de esforço para trocar Supabase por Cloud SQL (minha, não medida)

| Trabalho | Dias |
| --- | --- |
| Trocar o query builder do supabase-js por cliente SQL (pg, Kysely ou Drizzle) nas 19 arquivos | 3 a 5 |
| Reescrever `auth.uid()` e o RLS para um GUC por transação (`app.user_id`), mais ajuste do teste de RLS | 3 a 4 |
| Login: Identity Platform (ou Firebase Auth), sessão por cookie, convite, reset (a F2 já faria isso no Supabase) | 4 a 6 |
| Storage para GCS, URL pública | 0,5 |
| Provisionar Cloud SQL, conector no Cloud Run, backup com restore executado, IaC | 2 a 3 |
| **Total** | **13 a 19 dias úteis** |

Perde-se também a API REST gerada e o RLS "de graça" por JWT: toda leitura passa a ter servidor no
meio, o que é mais código para a F2.

## Custo mensal, cenário de piloto (3 tenants, menos de 1 GB, menos de 100 usuários)

| | Supabase | Google Cloud | AWS | Neon (só banco) |
| --- | --- | --- | --- | --- |
| Banco | incluso no Pro (Micro, crédito de US$ 10) | Cloud SQL `db-g1-small` ~US$ 26, ou `db-f1-micro` ~US$ 8 (sem SLA, não é para produção) | RDS `db.t4g.micro` ~US$ 12 (Single-AZ, us-east-1) | ~US$ 19 se 0,25 CU ligado 24h (US$ 0,106 por CU-hora); bem menos com scale to zero |
| Login | 100 mil MAU inclusos | Identity Platform: 50 mil MAU grátis | Cognito: 10 mil MAU grátis (pools novos) | não tem |
| Storage de arquivos | 100 GB inclusos | GCS, centavos | S3, centavos | não tem |
| Jobs e agenda | não tem (Edge Functions, pg_cron) | Cloud Run (2 M requisições grátis), Scheduler (3 jobs grátis) | Lambda + EventBridge, perto de zero | não tem |
| Disco, backup, rede (estimativa minha) | 8 GB inclusos | + US$ 2 a 4 | + US$ 2 a 4; **NAT Gateway, se a VPC for privada, soma ~US$ 33** | + US$ 0,35 por GB |
| **Total aproximado** | **US$ 25** | **US$ 30 a 35** (US$ 12 a 15 sem SLA) | **US$ 15 a 20, sobe para ~50 com NAT** | **US$ 20 + login e storage de outro lugar** |

Leitura:

- A diferença entre as opções é de **US$ 0 a 10 por mês**. Hora de engenharia domina qualquer uma.
- O Supabase Free pausa o projeto após uma semana sem uso: não serve para cron. O piloto precisa
  do Pro.
- Em login, o Supabase sai na frente: 100 mil MAU inclusos, depois US$ 0,00325 por MAU, contra
  US$ 0,0055 (Identity Platform, acima de 50 mil) e US$ 0,0055 (Cognito Lite, acima de 10 mil). Num
  produto B2B com dezenas ou centenas de usuários, isso nem aparece.
- O Supabase Pro não escala para zero: paga-se a instância 24h. O mesmo vale para Cloud SQL e RDS.
  Só Neon escala para zero.
- Regiões: não achei a diferença de preço para São Paulo. É costume a região ser mais cara que a
  dos EUA, então os valores acima tendem a subir. Conferir com o seletor de região antes de decidir.

## Onde cada opção ganha

| Opção | Ganha em | Perde em |
| --- | --- | --- |
| **Supabase** | Auth + RLS + REST + Storage num lugar só; ADR 0005 e CI de RLS já escritos; custo previsível | Compute fixo ligado 24h; jobs e agenda não são o forte; dependência de roles próprios |
| **Google Cloud** | Cloud Run Jobs para o `puppeteer` e os jobs pesados; Scheduler; Vertex AI (Gemini sob termos do Google Cloud e IAM em vez de chave de API); BigQuery se o analytics crescer; mesmo fornecedor do Gemini | Montar Auth, API e RLS à mão; Cloud SQL sem escala a zero; mais peças para operar sozinho |
| **AWS** | Maior catálogo; RDS barato no papel; Cognito com 10 mil MAU grátis | Mais peças e mais armadilhas de custo (NAT, I/O do Aurora; Aurora Serverless v2 tem piso de ~US$ 44 por mês segundo um comparativo); nada aqui precisa disso |
| **Neon** | Postgres puro com escala a zero, bom para staging e previews por branch | Só banco: login e storage ficam por sua conta |
| **Firestore** | Barato e simples | Modelo de documento não encaixa em dado relacional com RLS por tenant; descartado |
| **Fly, Railway, Render, Cloudflare** | Não avaliados a fundo. Cloudflare importa porque o `frontend-core` da Labrynth roda em Workers, mas isso é outro projeto | Sem dado verificado, fora desta análise |

## Caminho recomendado, em três degraus

**Degrau 1: agora, sem trocar o banco.** Criar o projeto Supabase novo (`sa-east-1`, conta separada,
já previsto na SPEC 006) e seguir a F2. Não gastar semanas em migração enquanto o gate do ADR 0004
(demanda dos pilotos, contrato, titularidade) não passou.

**Degrau 2: protótipo no Google Cloud, escopo de integração.** É o uso que você descreveu para este
projeto. Escopo pequeno e reversível:

1. Cloud Scheduler chamando `/api/cron/publish-due` (substitui o Vercel Cron, que está no limite).
2. Cloud Run Job para render de carrossel com `puppeteer` e para o `reflect`/`metrics` (substitui
   GitHub Actions).
3. Gemini via Vertex AI atrás de uma flag, comparando custo e latência com a chave atual.
4. Tudo falando com o Supabase por URL e service key. Nada de banco novo.

Isso entrega o aprendizado de operar no Google Cloud (IAM, Secret Manager, deploy, custo) por poucos
dólares e sem tocar no isolamento de tenant.

**Degrau 3: trocar o banco, só com gatilho.** Reavaliar Cloud SQL quando acontecer **um** destes:

- a fatura do Supabase passar de ~US$ 100 por mês por motivo que o Google Cloud resolveria mais barato;
- exigência de rede privada, região ou compliance que o Supabase não cobre;
- crédito de nuvem que cubra o custo (conferir elegibilidade: programas de startup costumam exigir
  empresa, e o ADR 0004 diz que ainda não há CNPJ);
- o produto precisar de BigQuery ou Vertex no mesmo perímetro do dado.

Para manter essa saída barata: SQL padrão nas migrations, `auth.uid()` só dentro dos dois helpers de
`app`, e acesso a dado atrás de uma camada fina em vez de `.from()` espalhado. A F2 já empurra nessa
direção.

## Spike opcional, 1 a 2 dias

Em branch descartável: subir Cloud SQL `db-f1-micro`, aplicar as 12 migrations com os roles de
`bootstrap.sql`, rodar `rls_test.sql` e um endpoint da plataforma com `pg`. Mede o esforço real
em vez da estimativa acima. Não vai para produção.

## Não verificado

- Preço de Cloud SQL, Cloud Run e RDS em São Paulo.
- Valores de disco, backup e rede (estimativas minhas, pelo que conheço dos catálogos).
- Plano de compute do Supabase acima do Micro e quanto custa.
- Elegibilidade a crédito de nuvem sem CNPJ.
- Se Vertex AI em `southamerica-east1` tem os modelos que a geração usa.
- O conteúdo da conversa do ChatGPT (link bloqueado).

## Fontes

- [Supabase pricing 2026 (JetAdmin)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- [Supabase pricing (MakerKit)](https://makerkit.dev/blog/md/saas/supabase-pricing)
- [Cloud SQL pricing (Bytebase)](https://www.bytebase.com/dbcost/cloudsql-pricing/)
- [Cloud SQL pricing 2026 (usage.ai)](https://www.usage.ai/blogs/gcp/cloud-sql/pricing/)
- [Cloud SQL pricing (Google)](https://cloud.google.com/sql/pricing?hl=en)
- [Identity Platform pricing (Google)](https://cloud.google.com/identity-platform/pricing)
- [GCP free tier 2026](https://agentdeals.dev/gcp-free-tier-2026)
- [RDS db.t4g.micro (Bytebase)](https://www.bytebase.com/dbcost/rds/instance/db.t4g.micro/)
- [Managed Postgres cost comparison 2026 (infratally)](https://infratally.com/articles/managed-postgres-cost-comparison/)
- [Amazon Cognito pricing](https://aws.amazon.com/cognito/pricing/)
- [Neon pricing](https://neon.com/pricing)
- [Managed PostgreSQL comparison 2026 (selfhost.dev)](https://selfhost.dev/managed-postgresql-comparison-2026/)
