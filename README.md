# post-automation

Automação de postagens Instagram + LinkedIn pra SaaS B2B. Geração via Claude, aprovação rápida via Telegram, publicação automática via GitHub Actions.

## O que faz

- Roda 3x/semana (seg/qua/sex 9h BRT)
- Lê próximo post da fila (`content/queue.yaml`) ou gera ideia automática baseada em pilar
- Pede 3 variações ao Claude (few-shot com seus high-performers)
- Renderiza um preview de imagem por variação via Puppeteer
- **Fase gerar** (`post.yml`): manda no Telegram 1 mensagem por variação + botões
  "aprovar #1 / #2 / #3 / regenerar / rejeitar", salva o pending e encerra
- **Fase resolver** (`resolve.yml`, cron a cada 10min na janela útil): lê sua
  decisão e publica / regenera / rejeita — o runner nunca fica preso esperando
- Você decide quando quiser; publica no próximo tick (≤10min)
- Publica em IG e LinkedIn e atualiza histórico (`content/published.yaml`)

## Setup rápido

1. `npm install`
2. Copiar `.env.example` → `.env` e preencher
3. `npm run dry-run` (testa pipeline sem APIs externas)
4. Detalhes completos em [SETUP.md](./SETUP.md)

## Scripts

| Comando | O que faz |
|---|---|
| `npm test` | Roda testes Vitest |
| `npm run dry-run` | Pipeline completo mockando APIs externas |
| `npm run publish:test` | Posta 1 item hardcoded em sandbox (precisa credencial) |
| `npm start` | Fase gerar: gera, manda preview, salva pending (workflow `post.yml`) |
| `npm run resolve` | Fase resolver: processa decisões do Telegram (workflow `resolve.yml`) |
| `npm run metrics` | Coleta insights da semana (TODO) |
| `npm run refresh-tokens` | Renova tokens IG + LinkedIn |

## Estrutura

```
docs/        estratégia (ICP, dores, voice) — lida pelos prompts
content/     fila + histórico em YAML versionado
prompts/     system + canais + pilares
templates/   HTML/CSS pra render via Puppeteer
src/         lógica
.github/     workflows GitHub Actions
```

## Estado atual

- [x] Estrutura base + geração + aprovação Telegram
- [x] Publicação Instagram + LinkedIn (single image + carrossel)
- [ ] Reels (fase 2)
- [ ] Métricas e ajuste automático do mix de pilares
- [ ] Dashboard web (provavelmente nunca — Telegram resolve)

## Custo mensal estimado

| Item | Custo |
|---|---|
| Claude API | R$ 5–15 |
| GitHub Actions | R$ 0 (free tier) |
| Telegram | R$ 0 |
| **Total** | **< R$ 20** |
