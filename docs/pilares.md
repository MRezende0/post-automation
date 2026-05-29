# Pilares de Conteúdo

> 4 pilares com peso fixo. Cada pilar tem 5 ângulos pra rodar. Sistema roda na rotação até completar ciclo, depois reinicia.

| Pilar | Peso | Objetivo |
|---|---|---|
| Dor nomeada | 40% | Identificação, seguidor novo, salvamento |
| Dica prática | 30% | Autoridade, share, perfil-visit |
| Building in public | 15% | Conexão pessoal, confiança |
| Prova social | 15% | Conversão, DM, lead |

> **Estratégia (ver `posicionamento.md`):** gancho de topo = planilha/WhatsApp/feeling; promessa de fundo = **lucro por projeto / controle**. As dores núcleo `[validada]` de `dores.md` (não saber se dá lucro, orçar no feeling, financeiro × operação desconectados) devem permear sobretudo **Dor** e **Dica**. Público: engenharia consultiva de projeto (não obra).

---

## 1. Dor nomeada (40%)

**Estrutura típica:**
- Linha 1: hook que nomeia situação específica
- Linhas 2–4: detalha a dor com elemento concreto
- Linha 5–6: implicação ("o que isso custa")
- Encerramento: pergunta retórica OU "tá construindo X pra resolver isso"

**5 ângulos:**

1. **Dor financeira** `[núcleo]` — não saber se o projeto deu lucro; orçar no feeling e ver a margem evaporar; faturamento por marco que se perde
2. **Dor de tempo** — domingo trabalhando, 23h ainda no escritório
3. **Dor de versão/arquivo** — Rev errada, arquivo perdido, histórico na cabeça do funcionário
4. **Dor relacional** — sócio brigando, cliente cobrando, funcionário sumindo
5. **Dor de identidade** — "virou gestor sem querer", "não consegue mais ser engenheiro"

---

## 2. Dica prática (30%)

**Estrutura típica:**
- Linha 1: promessa concreta ("aprenda a precificar projeto sem chutar")
- Lista numerada 3–5 itens
- Cada item: ação específica + por quê
- Encerramento: "salva isso pra usar no próximo orçamento"

**5 ângulos:**

1. **Precificação** `[núcleo]` — hora-vendida vs hora-trabalhada, margem real, como saber o custo do último projeto antes de orçar o próximo
2. **Controle de projeto** `[núcleo]` — os 3 indicadores que dizem se o projeto dá lucro; acompanhar execução vs marco; quando o projeto começa a drenar margem
3. **Cobrança** — script de cobrança WhatsApp, prazo, juros, quando demitir cliente
4. **Documentação** — versionamento de Rev, nomenclatura de arquivo, backup
5. **Time** — onboarding de estagiário, rotina semanal, divisão de tarefa

---

## 3. Building in public (15%)

**Estrutura típica:**
- Linha 1: decisão difícil ou bug confessado
- Por que essa decisão, com contexto
- O que aprendeu, número se tiver
- O que vem a seguir
- Sem CTA óbvio

**5 ângulos:**

1. **Decisão de produto** — cortei feature X porque…
2. **Erro confessado** — quebrou em produção, perdi dado, refiz tudo
3. **Número aberto** — MRR, n de waitlist, churn, primeiro cliente
4. **Por que estou construindo** — minha história, dor própria
5. **Próximo marco** — beta semana que vem, alpha com 3 clientes

---

## 4. Prova social (15%)

**Estrutura típica:**
- Frase específica do cliente OU número
- Contexto (quem é, quanto tempo usando, situação anterior)
- Resultado (o mais concreto possível)
- Sem ser autopromocional vulgar — deixar o cliente falar

**5 ângulos:**

1. **Citação direta** — print de WhatsApp ou frase autorizada
2. **Antes vs depois** — quanto tempo gastava, quanto gasta agora
3. **Lista de espera/uso** — "47 escritórios na lista de espera"
4. **Case curto** — situação, mudança, resultado em 3 linhas
5. **Cliente difícil convencido** — "achei que não ia funcionar pra mim porque…"

---

## Rotação

Sistema mantém histórico em `content/published.yaml` com `pilar` e `angulo`. Próxima escolha:

1. Pega pilar com maior dívida em relação ao peso (ex: 8 posts no mês, deveria ter 3 de dor mas só teve 1 → próximo é dor)
2. Dentro do pilar, escolhe ângulo menos usado nos últimos 30 dias
3. Dentro do ângulo, escolhe dor/dica não usada nos últimos 60 dias

Lógica em `src/utils/ranking.js`.
