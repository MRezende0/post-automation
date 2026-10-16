# Cockpit — plataforma do post-automation

UI web (Next.js App Router) que substitui o Telegram como interface de aprovação.
Você aprova, escolhe legenda + arte, **edita o texto** e **agenda** — a publicação sai
no horário marcado (não na hora da aprovação). O Telegram fica só pra notificações.

## Arquitetura

```
Inbox (pending_approvals)  →  aprovar + agendar  →  scheduled_posts (status=scheduled)
                                                          │ Vercel Cron */10min
                                                          ▼
                                              /api/cron/publish-due
                                                  publica IG/LinkedIn
                                                  grava em `posts` (reusa observabilidade)
                                                  → status=published | failed
                                                  → notifica Telegram
```

- **Acesso ao DB**: service_role só no server (Server Components / Route Handlers / cron).
  O browser nunca toca o Supabase. RLS continua fechado — sem policy nova.
- **Auth**: gate single-user por senha (`PLATFORM_PASSWORD`) + cookie assinado (HMAC).
- **Agendamento**: slots editoriais fixos (`publish_slots`). Aprovar cai no próximo slot
  livre do canal; dá pra sobrescrever com horário manual e remarcar na Agenda.
- **Por que `scheduled_posts` e não status em `posts`**: `posts` alimenta o bandit;
  um post não-publicado contaminaria o aprendizado. A fila vive em tabela separada e
  só vira `posts` no momento da publicação.

## Setup

### 1. Migrations (automáticas)

As migrations ficam em `../supabase/migrations/` e são aplicadas pelo CI
(`.github/workflows/ci.yml`, ADR 0003): toda PR testa todas num Postgres limpo e o merge
na `main` roda `supabase db push` no banco de produção. Ninguém aplica migration à mão.

Migration nova: próximo número da sequência (`0010_...sql`), aditiva e idempotente
(`if not exists`, `drop ... if exists` antes de `create trigger`). Comando que apaga dado
exige `-- allow-destructive` no arquivo.

Pré-requisito único: o segredo `SUPABASE_DB_URL` (Session Pooler, IPv4) no environment
`Production` do GitHub.

Confira: `npm run check:db` → deve listar `publish_slots` e `scheduled_posts` ✅.

### 2. Variáveis

Copie `.env.local.example` → `.env.local` (dev) ou configure no Vercel (prod).
As credenciais de Supabase/Telegram/IG/LinkedIn são as mesmas do backend.

### 3. Rodar

```bash
npm install
npm run dev        # http://localhost:3000 (login: PLATFORM_PASSWORD)
npm run build      # build de produção
npm run check:db   # valida conexão + presença das tabelas
```

## Deploy (Vercel)

- Root directory: `platform/`
- Variáveis de ambiente: as do `.env.local.example` (use valores reais).

### Scheduler (cron)

O plano **Hobby** do Vercel só roda cron 1×/dia, então o `*/10` não cabe lá. O
disparo do scheduler vive num **GitHub Action** (`.github/workflows/publish-due.yml`,
a cada 10min) que faz `POST /api/cron/publish-due` com `Authorization: Bearer
$CRON_SECRET`. Configure no repositório os secrets:

- `PLATFORM_URL` — a URL do app no Vercel (ex: `https://post-automation.vercel.app`)
- `CRON_SECRET` — o mesmo valor das env vars do Vercel

Se migrar pra **Vercel Pro**, basta recriar `platform/vercel.json` com
`{ "crons": [{ "path": "/api/cron/publish-due", "schedule": "*/10 * * * *" }] }`
e desativar o Action.

## Telas

| Rota | O quê |
|------|-------|
| `/inbox` | pendências aguardando decisão (lê `pending_approvals`) |
| `/inbox/[id]` | aprovar: escolher legenda (editável) + arte + horário |
| `/calendar` | agenda dos `scheduled_posts`: reagendar / cancelar / re-tentar |
| `/history` | posts publicados + engajamento (lê `posts`) |
| `/settings` | gerir a grade de slots editoriais |

## O que mudou no backend Node

Nada (ainda). A plataforma lê/escreve o mesmo Supabase. Próximos passos opcionais:
desligar o publish do GitHub Actions (resolve.js) e reduzir `src/telegram.js` a
notificações, já que a aprovação migrou pra cá.
