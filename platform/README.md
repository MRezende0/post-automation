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

### 1. Aplicar a migration (única ação que exige acesso ao projeto pessoal)

O schema das tabelas novas está em `../supabase/migrations/0002_platform_scheduling.sql`.
Aplique de uma das formas:

**SQL Editor (mais rápido):** copie o conteúdo do arquivo e rode no SQL Editor do
projeto `utluhhgifniiuailkxvx` no dashboard do Supabase.

**Supabase CLI (conta pessoal):**
```bash
supabase login                                  # conta dona do projeto pessoal
supabase link --project-ref utluhhgifniiuailkxvx
supabase db push                                # aplica 0002 (0001 é idempotente)
```

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
