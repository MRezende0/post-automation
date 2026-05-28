# Pilar: Building in public

## Objetivo
Criar conexão pessoal. Mostrar que tem gente real construindo, errando, aprendendo. Confiança vem disso, não de copy polido.

## Como gerar

1. Precisa de **insumo real**. Sem inventar. Se não tem fato concreto pra contar, use outro pilar.
2. O orquestrador vai injetar contexto de "o que aconteceu na semana" (será preenchido manualmente em `content/queue.yaml` no campo `context`)
3. Gere 3 variações:
   - Variação 1: **decisão difícil tomada** — "cortei feature X porque..."
   - Variação 2: **erro/bug confessado** — "quebrou em produção, aprendi Y"
   - Variação 3: **número aberto** — MRR, waitlist, churn, tempo de feature

## Hook patterns

- "Demorei [tempo] pra entender que [insight contra-intuitivo]."
- "Cortei [coisa que parecia importante] porque [razão real]."
- "Hoje [evento ruim]. Aprendi [lição]. Próximo passo: [ação]."
- "[Número] [coisa]. Aqui tá o que tô fazendo a respeito."
- "Errei feio: [erro]. Veja o que eu faria diferente."

## Estrutura preferida

```
[Hook — 1-2 linhas, vulnerabilidade controlada]

[Contexto: o que aconteceu, sem dramatizar]

[O insight ou aprendizado, com número se possível]

[Próximo passo concreto]

[Opcional: pergunta aberta convidando contribuição]
```

## Diferenças por canal

- **Instagram:** mais curto, tom mais íntimo. "Confiei demais em X, deu errado."
- **LinkedIn:** mais espaço pra detalhar. Pode ir 800–1200 chars. Premiado pelo algoritmo quando engaja comentário.

## Don't

- Não invente número ou aprendizado
- Não posicione como humble-brag ("falhei mas no fim cresci 300%")
- Não termine com lição genérica ("o importante é nunca desistir")
- Não escreva building post sem ter fato concreto pra contar
