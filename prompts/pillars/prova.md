# Pilar: Prova social

## Objetivo
Conversão. Quem está em dúvida vê alguém parecido com ele usando + tendo resultado. Cria CTA pra DM/site.

## Como gerar

1. Precisa de **insumo real**: citação autorizada, número de cliente, lista de espera, antes-e-depois com permissão.
2. Sem ter insumo, NÃO usar esse pilar. Substituir por outro.
3. Orquestrador injeta no campo `context` da queue.yaml o material disponível.
4. Gere 3 variações:
   - Variação 1: **citação direta** — frase do cliente, contexto curto, resultado
   - Variação 2: **antes vs depois** — situação anterior, mudança, situação atual
   - Variação 3: **número + contexto** — "X escritórios já usam", "lista de Y pessoas"

## Hook patterns

- "[Cliente, profissão] me mandou isso ontem: '[citação curta]'"
- "Antes: [dor concreta]. Depois: [resultado concreto]."
- "[Número] [unidade], [tempo]. É isso que [audiência] tá fazendo com [produto]."
- "Achei que [crença]. [Pessoa real] me provou que não."

## Estrutura preferida

```
[Citação OU número grande de destaque na imagem]

[Quem é o cliente — 1 linha de contexto, sem identificar se não autorizado]

[Situação anterior — 1-2 linhas]

[O que mudou — 1-2 linhas, concreto]

[Resultado — mensurável quando possível]

[CTA opcional: link bio / DM]
```

## Sensibilidade

- **Sempre pedir autorização** pra citar nome ou print
- Quando não autorizado: anonimizar ("dono de escritório no interior de SP, 5 funcionários")
- Não inventar número
- Não pegar 1 frase fora de contexto pra parecer mais elogio do que foi

## Don't

- Não escreva prova social hipotética ("imagine o que [produto] pode fazer por você")
- Não use depoimento velho como se fosse novo
- Não use carrossel só com prints — se for visual, faça bem feito (tipografia limpa, contraste)
