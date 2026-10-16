# Arquitetura de usuário (proposta, 16/10/2026)

> Proposta, não decisão. Complementa a [arquitetura SaaS](README.md) (contas PF e PJ, papéis) e a
> [SPEC 007](../specs/007-avisos-sem-telegram.md) (avisos). Tela nova só vira código depois do
> protótipo no Claude Design: o briefing está no fim.

| Desenho | O que mostra |
| --- | --- |
| [05 mapa de telas](gcp/05-mapa-de-telas.png) | cada tela e quem edita, só vê ou não vê |
| [06 jornadas](gcp/06-jornadas.png) | cadastro até o primeiro post, convite da equipe, login do dia a dia |
| [07 ciclo por papel](gcp/07-ciclo-por-papel.png) | o que cada papel faz em cada etapa e quem recebe cada aviso |

## Telas e acesso

Legenda: **E** edita, **V** só vê, **?** se o administrador liberar, **·** não vê (a tela some do menu).

| Área | Tela | Administrador | Criador | Leitor |
| --- | --- | --- | --- | --- |
| Entrada | Entrar, criar conta, esqueci a senha, aceitar convite, MFA, escolher conta | qualquer pessoa | | |
| Topo | Seletor de conta, sino de avisos, perfil | E | E | E |
| Plataforma | Início (o que precisa de você) | E | E | V |
| | Aprovar (inbox de posts e ideias) | E | ? | V (dá parecer) |
| | Criar (brief, campanha, gerar com IA) | E | E | · |
| | Agenda (reagendar, cancelar, pausar) | E | V | V |
| | Publicados (histórico e métricas) | V | V | V |
| | Aprendizado (feedback e o que a IA aprendeu) | E | E | E (feedback) |
| | Engajamento (comentar pela API) | E | E | · |
| | Avisos | E | E | E |
| | Perfil (nome, senha, MFA, e-mail de aviso) | E | E | E |
| Configurações | Marca e voz | E | V | · |
| | Redes conectadas | E | · | · |
| | Equipe | E | · | · |
| | Plano e cobrança | E | · | · |
| | Auditoria | V | · | · |
| | Dados e privacidade (exportar, excluir) | E | · | · |
| Console do ultra admin | Contas, pessoas, suporte, operação, custos, cobrança | só o Matheus, em outro endereço ([ultra-admin.md](ultra-admin.md)) | | |

Regras de acesso:

1. **Tela que o papel não vê some do menu** e a rota responde 404, não 403: não revela que existe.
2. **A tela segue o banco, não o contrário.** O que esconde o botão é a mesma regra (`app.can`)
   que o RLS aplica. Esconder na tela é conforto; quem barra é o servidor.
3. **PF tem as mesmas telas.** A pessoa é a administradora e vê tudo, sem seletor de conta. Em
   Equipe aparece o convite para subir de plano no lugar da lista de pessoas.
4. **Leitor** é o revisor: quem acompanha e opina (sócio, cliente da agência). Lê, dá parecer
   (aprovo ou ajustar, com comentário) e feedback. O parecer orienta quem aprova; não publica.

## Jornadas

**Cadastro até o primeiro post.** Criar conta (PF ou empresa) abre o teste grátis. Sem confirmar
o e-mail, nada sai. O onboarding tem 3 passos com progresso derivado do dado: conectar uma rede,
contar sobre o negócio, aprovar a primeira ideia. Dá para pular e voltar.

**Convite da equipe.** O administrador convida por e-mail com o papel. O convite vale 7 dias e é
de uso único. Quem não tem login cria a senha no aceite. Administrador configura MFA antes de
entrar. Os administradores recebem aviso e o audit log registra.

**Pedido de revisão.** Criador ou administrador escolhe os leitores que devem opinar sobre um post.
Cada leitor recebe o aviso, dá o parecer na inbox, e quem aprova vê os pareceres antes de decidir.

**Dia a dia.** Entrar com senha ou link, MFA se o papel exige, escolher a conta se estiver em mais
de uma (a plataforma lembra a última) e cair no Início com o que precisa de ação.

Regras de sessão: cookie httpOnly e curto, renovado no uso; trocar de conta troca o tenant da
sessão no servidor; sair encerra a sessão em todos os dispositivos se a pessoa pedir; remover
alguém da equipe derruba a sessão dele naquela conta na hora.

## Avisos por papel

| Aviso | Administrador | Criador | Leitor | E-mail |
| --- | --- | --- | --- | --- |
| Pedido de parecer | | | sim | sim |
| Post pronto para aprovar | sim | se liberado | | |
| Agendado e publicado | sim | sim | | |
| Falha ao publicar | sim | sim | | sim |
| Token de rede vencendo | sim | | | sim |
| Relatório semanal | sim | sim | sim | sim |
| Cobrança, plano e teste grátis | sim | | | sim |
| Mudança na equipe | sim | | | sim |

Cada pessoa escolhe no perfil o que recebe por e-mail; o crítico (falha, token, cobrança) não
desliga. Implementação: um campo `audience` no aviso (`admins`, `approvers`, `reviewers`, `all`) e
leitura por pessoa numa tabela própria, que nascem junto com a tela de avisos.

## O que muda no código (quando os protótipos forem aprovados)

- `tenant_members.role` passa a `admin`, `creator`, `viewer` (`owner` vira `admin`, `editor` vira
  `creator`); tabela `role_permissions` e helper `app.can(tenant, permissão)`; teste de RLS cobre a
  matriz e a regra do último administrador.
- Pareceres: tabela `reviews` (post, leitor, aprovo ou ajustar, comentário).
- Configuração da conta: `approval_required` (criador aprova sozinho ou não).
- Convites: tabela `invitations` com token de uso único, validade de 7 dias e papel.
- Avisos: `audience` em `notifications` e `notification_reads` por pessoa.
- Menu e rotas lidos de uma única lista de telas com a permissão de cada uma.

## Briefing para o Claude Design

Produto: plataforma que gera, aprova e publica posts de Instagram, LinkedIn e X para pessoas e
empresas, com IA. Público: sócio ou responsável de marketing de empresa pequena, profissional
autônomo e agência. Desktop no dia a dia, celular para aprovar e ver avisos.

Telas (cada uma em desktop e mobile, com os estados vazio, carregando, erro e cheio):

1. **Barra do topo e menu**, nas variações de cada papel (administrador, criador, leitor) e na conta
   PF. Seletor de conta só quando há mais de uma.
2. **Início**: "o que precisa de você" (posts para aprovar, falhas, tokens vencendo) e um resumo da
   semana. Variação do leitor: pareceres pedidos e o resumo.
3. **Avisos**: sino com contador, lista agrupada por dia, lido e não lido, cada aviso com o botão
   que leva à tela onde se resolve.
4. **Equipe**: lista com papel, convidar (e-mail e papel), reenviar e cancelar convite, mudar
   papel, remover. Variação PF: convite para subir de plano.
5. **Aceitar convite**: válido, expirado, já aceito, e criar senha.
6. **Onboarding**: checklist lateral de 3 passos, passo atual em destaque.
7. **Aprovar, visão do criador** quando a conta exige aprovação: "Enviar para aprovação" no lugar
   de "Aprovar e agendar", e "Pedir revisão" com a escolha dos leitores.
8. **Parecer do leitor**: o post com as versões por rede, "Aprovo" e "Pedir ajuste" com
   comentário. Estados: pendente, enviado, post já decidido.
9. **Console do ultra admin**: desenho 08 e [ultra-admin.md](ultra-admin.md); só desktop.

Dados seed: conta "Escritório Exemplo" (empresa de engenharia) com Ana (sócia, administradora),
Bruno (marketing, criador) e Carla (coordenadora, leitora); conta pessoal "Matheus"; 3 posts para
aprovar, 2 pareceres pedidos à Carla, 1 falha no LinkedIn, 1 token do Instagram vencendo em 5 dias.

Restrições: microcopy em português, voz ativa, sentence case, botão com verbo; erro diz o que houve
e o próximo passo; sem emoji decorativo. Visual atual do cockpit (fundo escuro, acento roxo) até a
marca existir.
