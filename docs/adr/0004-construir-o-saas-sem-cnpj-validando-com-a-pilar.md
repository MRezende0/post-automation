# ADR 0004: construir o SaaS agora, sem CNPJ, validando com a Pilar

- **Status:** aceito
- **Data:** 2026-10-16
- **Revisão:** 2026-11-27 (6 semanas)
- **Estende:** [ADR 0002](0002-plataforma-como-produto-proprio.md) (a plataforma é produto próprio)
- **Base:** [análise de viabilidade](../analises/2026-10-16-viabilidade-saas.md) e
  [concorrentes e insights](../analises/2026-10-16-concorrentes-e-insights.md)

## Contexto

O ADR 0002 diz que a plataforma é produto próprio e que o 2º cliente destrava login por tenant,
cobrança e cadastro self-service. Faltava decidir **se vale construir como SaaS** e **em que
ordem**, antes de gastar com empresa, marca e aprovações das redes.

A análise de 2026-10-16 mostrou:

- Conectar contas de clientes é viável (OAuth, várias contas por app), mas exige Business
  Verification e App Review da Meta, feitos uma vez pelo dono do app e só quando houver cliente
  fora.
- Gerar e agendar posts é commodity: Buffer a US$ 5 por canal, Postiz gratuito, mLabs a
  R$ 29,90 por marca, Blotato a US$ 29.
- O que não achei nos concorrentes: campanha coerente entre redes mais ciclo de aprendizado até
  cadastro ativado. O código já tem a ideia única por rodada (SPEC 003) e o funil da Pilar no
  bandit (SPEC 004, em implementação).
- Demanda externa não provada. Ninguém de fora pagou.

## Decisão

1. **Construir o SaaS agora**, sem CNPJ, sem nome e sem marca. O repo continua o produto
   (ADR 0002) e a Pilar continua o tenant `pilar`.
2. **Posicionamento:** motor de campanha que aprende até a conversão, para escritório de projeto
   (engenharia e arquitetura), em **3 redes**: Instagram, LinkedIn e X. Não é gerenciador de redes
   sociais e não disputa amplitude de redes nem preço de agendamento.
3. **Validar antes de abrir empresa:** a campanha da Pilar medida até cadastro ativado é o
   primeiro caso. Depois, 10 conversas com donos de escritório e 3 pilotos com onboarding
   manual (o Matheus conecta a conta do piloto no app em modo dev e opera).
4. **Fora do escopo até o gate passar:** CNPJ, Business Verification, App Review da Meta,
   Community Management API do LinkedIn, tela pública de "Conectar", cobrança, nota fiscal,
   nome e marca, redes além das 3.
5. **Quando chegar a hora da conexão pública:** Instagram Login (não Facebook Login), só conta
   profissional, uma verificação do CNPJ do SaaS valendo para todos os clientes.

## Gates (só depois deles abre empresa e cobra)

| Gate | Condição |
| --- | --- |
| Contrato | Contrato com a Labrynth lido: PI, exclusividade e atividade paralela não impedem |
| Titularidade | Combinado por escrito quem tem direito sobre o código e sobre a marca da Pilar (Trinity) |
| Caso Pilar | Ao menos uma peça com cadastro ativado atribuído por UTM |
| Demanda | 2 de 3 pilotos aceitam pagar, ou ao menos ~R$ 150/mês por escritório (limiar sugerido, ajustável) |
| Sustentável | Menos de ~5 h por semana de suporte e manutenção por piloto, e custo por campanha bem abaixo do preço |

Falhou em 2 ou mais: o produto continua como ferramenta interna da Pilar, que já tem valor para o
lançamento de 19/01/2027.

## Alternativas descartadas

- **Abrir CNPJ e marca agora:** gasta dinheiro e tempo antes de provar demanda.
- **Produto horizontal de agendamento:** mercado saturado, margem pressionada.
- **API agregadora (Ayrshare e similares) para publicar:** adia o App Review, mas custa por perfil
  (Ayrshare Business: US$ 599 por mês com mínimo de perfis) e cria dependência. Fica como plano B
  se a Meta atrasar demais no momento de abrir.
- **Cobrir "todas as redes":** os concorrentes cobrem 9 a 30 e cada rede nova pede API e aprovação.

## Consequências

- **Ganha:** foco no que o mercado não mostra (campanha coerente com aprendizado por conversão) e
  custo de decisão baixo.
- **Custa:** suporte manual nos pilotos e dependência da Pilar como único caso real no início.
- **Risco aceito:** a lacuna pode fechar. Hootsuite, Predis e Blotato mudaram de posição em poucos
  meses (agente, anúncios e MCP).
- **Risco aberto:** o ciclo até conversão exige que cada cliente instrumente o produto dele (UTM e
  evento de conversão). Só a Pilar tem isso pronto.
- **Reverter:** nada aqui altera código. Basta não passar do gate.

## Próximos passos

1. Ler o contrato com a Labrynth.
2. Fechar a Fase A da SPEC 001 e a SPEC 004 (funil no bandit).
3. Exigir "conta concreta" (horas × valor = R$) nas peças de dica e dor: guardrail em
   `checkGuardrails` e prompt de pilar. No reteste, o top-1 saiu com "3 dias extras de trabalho"
   e sem a conta em R$.
4. Medir custo por campanha (Gemini, imagem, vídeo e API do X, que cobra US$ 0,20 por post com
   link).
5. Marcar as 10 conversas e escolher os 3 pilotos.
