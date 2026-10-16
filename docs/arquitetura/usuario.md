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

| Área | Tela | Dono | Admin | Criador | Usuário |
| --- | --- | --- | --- | --- | --- |
| Entrada | Entrar, criar conta, esqueci a senha, aceitar convite, MFA, escolher conta | qualquer pessoa | | | |
| Topo | Seletor de conta, sino de avisos, perfil | E | E | E | E |
| Plataforma | Início (o que precisa de você) | E | E | E | V |
| | Aprovar (inbox de posts e ideias) | E | E | ? | V (comenta) |
| | Criar (brief, campanha, gerar com IA) | E | E | E | · |
| | Agenda (reagendar, cancelar, pausar) | E | E | V | V |
| | Publicados (histórico e métricas) | V | V | V | V |
| | Aprendizado (feedback e o que a IA aprendeu) | E | E | E | E (feedback) |
| | Engajamento (comentar pela API) | E | E | E | · |
| | Avisos | E | E | E | E |
| | Perfil (nome, senha, MFA, e-mail de aviso) | E | E | E | E |
| Configurações | Marca e voz | E | E | V | · |
| | Redes conectadas | E | E | · | · |
| | Equipe | E | E | · | · |
| | Plano e cobrança | E | · | · | · |
| | Auditoria | V | V | · | · |
| | Dados e privacidade (exportar, transferir, excluir) | E | · | · | · |
| Console interno | Contas, suporte, saúde, custos | só a equipe da plataforma, em outro endereço, atrás do IAP | | | |

Regras de acesso:

1. **Tela que o papel não vê some do menu** e a rota responde 404, não 403: não revela que existe.
2. **A tela segue o banco, não o contrário.** O que esconde o botão é a mesma regra (`app.can`)
   que o RLS aplica. Esconder na tela é conforto; quem barra é o servidor.
3. **PF tem as mesmas telas.** A dona vê tudo, sem seletor de conta. Em Equipe aparece o convite
   para subir de plano no lugar da lista de pessoas.
4. **Usuário** é o papel de quem acompanha (cliente da agência, sócio): lê, comenta e dá feedback.
   Sugestão de nome na tela: **Leitor**.

## Jornadas

**Cadastro até o primeiro post.** Criar conta (PF ou empresa) abre o teste grátis. Sem confirmar
o e-mail, nada sai. O onboarding tem 3 passos com progresso derivado do dado: conectar uma rede,
contar sobre o negócio, aprovar a primeira ideia. Dá para pular e voltar.

**Convite da equipe.** Dono ou admin convida por e-mail com o papel. O convite vale 7 dias e é de
uso único. Quem não tem login cria a senha no aceite. Dono e admin configuram MFA antes de entrar.
O dono recebe aviso e o audit log registra.

**Dia a dia.** Entrar com senha ou link, MFA se o papel exige, escolher a conta se estiver em mais
de uma (a plataforma lembra a última) e cair no Início com o que precisa de ação.

Regras de sessão: cookie httpOnly e curto, renovado no uso; trocar de conta troca o tenant da
sessão no servidor; sair encerra a sessão em todos os dispositivos se a pessoa pedir; remover
alguém da equipe derruba a sessão dele naquela conta na hora.

## Avisos por papel

| Aviso | Dono | Admin | Criador | Usuário | E-mail |
| --- | --- | --- | --- | --- | --- |
| Post pronto para aprovar | sim | sim | se liberado | | |
| Agendado e publicado | sim | sim | sim | | |
| Falha ao publicar | sim | sim | sim | | sim |
| Token de rede vencendo | sim | sim | | | sim |
| Relatório semanal | sim | sim | sim | sim | sim |
| Cobrança, plano e teste grátis | sim | | | | sim |
| Mudança na equipe | sim | | | | sim |

Cada pessoa escolhe no perfil o que recebe por e-mail; o crítico (falha, token, cobrança) não
desliga. Implementação: um campo `audience` no aviso (`approvers`, `editors`, `all`, `owner`) e
leitura por pessoa numa tabela própria, que nascem junto com a tela de avisos.

## O que muda no código (quando os protótipos forem aprovados)

- `tenant_members.role` passa a `owner`, `admin`, `creator`, `viewer`; tabela `role_permissions` e
  helper `app.can(tenant, permissão)`; teste de RLS cobre a matriz.
- Configuração da conta: `approval_required` (criador aprova sozinho ou não).
- Convites: tabela `invitations` com token de uso único, validade de 7 dias e papel.
- Avisos: `audience` em `notifications` e `notification_reads` por pessoa.
- Menu e rotas lidos de uma única lista de telas com a permissão de cada uma.

## Briefing para o Claude Design

Produto: plataforma que gera, aprova e publica posts de Instagram, LinkedIn e X para pessoas e
empresas, com IA. Público: dono ou responsável de marketing de empresa pequena, profissional
autônomo e agência. Desktop no dia a dia, celular para aprovar e ver avisos.

Telas (cada uma em desktop e mobile, com os estados vazio, carregando, erro e cheio):

1. **Barra do topo e menu**, nas variações de cada papel (dono, admin, criador, usuário) e na conta
   PF. Seletor de conta só quando há mais de uma.
2. **Início**: "o que precisa de você" (posts para aprovar, falhas, tokens vencendo) e um resumo da
   semana. Variação do usuário: só o resumo.
3. **Avisos**: sino com contador, lista agrupada por dia, lido e não lido, cada aviso com o botão
   que leva à tela onde se resolve.
4. **Equipe**: lista com papel, convidar (e-mail e papel), reenviar e cancelar convite, mudar
   papel, remover. Variação PF: convite para subir de plano.
5. **Aceitar convite**: válido, expirado, já aceito, e criar senha.
6. **Onboarding**: checklist lateral de 3 passos, passo atual em destaque.
7. **Aprovar, visão do criador** quando a conta exige aprovação: "Enviar para aprovação" no lugar
   de "Aprovar e agendar".

Dados seed: conta "Escritório Exemplo" (empresa) com Matheus (dono), Ana (administradora), Bruno
(criador) e Carla (usuária); conta pessoal "Matheus"; 3 posts para aprovar, 1 falha no LinkedIn,
1 token do Instagram vencendo em 5 dias.

Restrições: microcopy em português, voz ativa, sentence case, botão com verbo; erro diz o que houve
e o próximo passo; sem emoji decorativo. Visual atual do cockpit (fundo escuro, acento roxo) até a
marca existir.
