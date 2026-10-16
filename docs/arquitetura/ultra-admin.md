# Ultra admin (proposta, 16/10/2026)

> O papel de plataforma com todos os acessos e controles, igual ao da Pilar, e exclusivo do
> Matheus. Desenho: [08 ultra admin](gcp/08-ultra-admin.png). Vira ADR e SPEC quando aprovado.
> Levantado no cofre (`personal/features/pilar/`) e no código da Pilar
> (`~/Documents/Trinity/pilar`, commit `c8ee06ac`).

## O que a Pilar tem hoje

| Peça | Onde mora na Pilar | O que faz |
| --- | --- | --- |
| Papel `ultra_admin` | `profiles.role`, a mesma coluna dos papéis de empresa | dá acesso ao portal e passa por cima dos gates de feature |
| Trava de promoção | trigger `protect_ultra_admin` (`20260425000001_features_columns_and_rls.sql`) | ninguém vira nem deixa de ser ultra admin sem service role |
| Anti-tampering | `tg_prevent_profile_tampering` | bloqueia trocar papel, empresa e features pelo próprio usuário |
| Portal | `src/pages/ultra-admin/*`, rotas `/ultra-admin/*` | Visão geral, Empresas, Usuários, Testes (teste grátis), Funcionalidades, Feedback, Atividade, Incidentes, Custos de IA, Pedidos LGPD |
| Ações de empresa | `supabase/functions/ultra-admin-empresas` | criar, editar, converter para pago, marcar convidada, ligar feature em massa, excluir |
| Ações de usuário | `supabase/functions/ultra-admin-usuarios` | convidar, reenviar e cancelar convite, mudar acesso, excluir |
| Impersonação | `impersonation_sessions` + `log-impersonation` | "ver como" com sessão no servidor, expira em 30 min, registrada |
| Audit log | `supabase/functions/_shared/audit.ts` (`logAction`) | ator, categoria, alvo, empresa e IP, com e-mail e metadado sanitizados |
| Avisos | `aviso-ultra-admin-email` (SPEC 113 da Pilar) | todo aviso de plataforma (cadastro, feedback, plano bloqueado) também vai por e-mail na hora |

## Como fica aqui

**Mesmo poder, mais portões.** Três mudanças em relação à Pilar:

1. **Tabela própria, de uma linha só.** O ultra admin não é um valor da coluna de papel das contas.
   Mora em `platform_admins`, que aceita no máximo uma linha. Nenhum administrador de cliente vira
   ultra admin por engano, por bug de tela ou por uma policy mal escrita.
2. **Sem bypass no RLS.** Na Pilar, policies passam por cima para o `ultra_admin`. Aqui as policies
   de conta continuam simples, e o console lê e grava por funções do servidor, cada uma registrada
   no audit log.
3. **Portões em série.** Para abrir o console, todos precisam passar:
   - login com o e-mail pessoal;
   - MFA por app autenticador (sem SMS);
   - o e-mail confere com `PLATFORM_ADMIN_EMAIL` (sem a variável, ninguém entra);
   - o id está em `platform_admins`;
   - com o Google Cloud, o IAP na frente do endereço do console.

   Qualquer "não" responde 404 e manda um e-mail para você.

### Garantias de exclusividade (cada uma vira teste no CI)

```sql
create table platform_admins (
  singleton  boolean primary key default true check (singleton),  -- no máximo uma linha
  user_id    uuid not null unique,
  email      text not null,
  granted_at timestamptz not null default now()
);
alter table platform_admins enable row level security;  -- sem policy: a API não lê nem grava
revoke all on platform_admins from anon, authenticated;
```

- Só uma migration revisada em PR grava em `platform_admins`. Nenhuma tela promove ninguém.
- O teste reprova uma segunda linha, grant para `anon` ou `authenticated`, ou policy de tabela de
  conta que mencione o ultra admin (bypass).
- `audit_events` só aceita inserção: sem `update` nem `delete` para ninguém além da migration.
- A rota do console responde 404 para qualquer sessão que não passe nos portões (teste de rota).

### Console (seções, a partir da Pilar)

| Seção | O que faz aqui |
| --- | --- |
| Visão geral | contas ativas, em teste grátis e pagantes, receita, posts do dia, falhas, custo do dia |
| Contas | criar, editar plano e limites, estender teste com motivo, suspender, reativar, pausar a publicação, excluir com confirmação |
| Pessoas | buscar por e-mail, ver contas e papéis, reenviar convite, encerrar sessões, zerar MFA |
| Funcionalidades | ligar e desligar por conta ou em massa |
| Teste grátis | quem está no teste, estender com motivo, retenção depois do teste |
| Suporte | ver como a conta: motivo obrigatório, 30 min, banner na tela; editar no lugar do cliente pede MFA de novo; nunca mostra token de rede |
| Operação | filas e jobs, saúde por rede, pausa global, desligar uma rede inteira (quando a Meta muda a API), desligar a geração de IA |
| Custos de IA e mídia | por conta, por rede e por dia, com limite que dispara alerta |
| Cobrança | assinaturas, inadimplência, eventos do webhook do Asaas |
| Feedback e incidentes | o que os clientes mandaram e o que quebrou |
| Atividade | audit log: suas ações e as ações sensíveis das contas |
| Pedidos LGPD | exportação e exclusão, com prazo |

Avisos para você (no console e por e-mail, na hora): cadastro novo, feedback, falha de cobrança,
incidente, custo acima do limite, tentativa negada no console.

## Dependências e ordem

1. **Login por pessoa** (F2 da SPEC 006): sem ele não há `user_id` para pôr em `platform_admins`.
2. `audit_events` e o helper de auditoria (servem ao ultra admin e às contas).
3. `platform_admins`, portões e rota do console vazia, com os testes de exclusividade.
4. Seções na ordem: Contas, Pessoas, Operação (pausas), Suporte (impersonação), Custos, o resto.
5. O IAP entra quando houver projeto no Google Cloud; até lá valem os quatro primeiros portões.

O console é tela nova: o layout nasce de protótipo no Claude Design, só desktop.

## Para decidir

- Qual e-mail pessoal vai em `PLATFORM_ADMIN_EMAIL`. Não o da Labrynth.
- Se um dia houver uma segunda pessoa de suporte, ela entra como papel separado ("suporte", só
  leitura e impersonação de leitura), e a tabela de uma linha continua sua.
