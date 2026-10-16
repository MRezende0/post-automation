// funnel.js: parte pura da coleta do funil da Pilar (SPEC 004). Valida a resposta do
// ops-export-funil na entrada, normaliza para a chave de funnel_daily e soma por post.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DISTRIBUTION_CONTENT = /^d[0-9a-f]{8}$/;
export const MAX_WINDOW_DAYS = 120;

function count(value, field, i) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Funil da Pilar: linha ${i}, "${field}" precisa ser inteiro >= 0 (veio ${JSON.stringify(value)})`);
  }
  return value;
}

function utm(value, field, i) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error(`Funil da Pilar: linha ${i}, "${field}" precisa ser texto ou null`);
  return value.trim();
}

// Falha cedo e claro se a Pilar mudar o contrato, em vez de gravar lixo.
export function parseFunnelResponse(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.linhas)) {
    throw new Error('Funil da Pilar: resposta sem a lista "linhas"');
  }
  if (!DAY.test(body.desde ?? '') || !DAY.test(body.ate ?? '')) {
    throw new Error('Funil da Pilar: resposta sem "desde"/"ate" no formato AAAA-MM-DD');
  }
  const rows = body.linhas.map((l, i) => {
    if (!l || typeof l !== 'object') throw new Error(`Funil da Pilar: linha ${i} inválida`);
    if (!DAY.test(l.dia ?? '')) throw new Error(`Funil da Pilar: linha ${i}, "dia" precisa ser AAAA-MM-DD`);
    return {
      day: l.dia,
      utm_source: utm(l.utm_source, 'utm_source', i),
      utm_medium: utm(l.utm_medium, 'utm_medium', i),
      utm_campaign: utm(l.utm_campaign, 'utm_campaign', i),
      utm_content: utm(l.utm_content, 'utm_content', i),
      cadastros: count(l.cadastros, 'cadastros', i),
      ativados: count(l.ativados, 'ativados', i),
      pagantes: count(l.pagantes, 'pagantes', i),
    };
  });
  return { desde: body.desde, ate: body.ate, rows };
}

// Janela [hoje - (dias - 1), hoje] no fuso de Brasília, como a Pilar conta o dia.
export function funnelWindow(now = new Date(), days = MAX_WINDOW_DAYS) {
  const fmt = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
  const ate = fmt(now);
  const desde = fmt(new Date(now.getTime() - (days - 1) * 86400000));
  return { desde, ate };
}

export function isDistributionContent(content) {
  return DISTRIBUTION_CONTENT.test(content || '');
}

// Soma por utm_content de distribuição (o que liga a um post). Bio e UTM manual ficam de fora.
export function totalsByContent(rows) {
  const out = new Map();
  for (const r of rows) {
    if (!isDistributionContent(r.utm_content)) continue;
    const t = out.get(r.utm_content) || { cadastros: 0, ativados: 0, pagantes: 0 };
    t.cadastros += r.cadastros;
    t.ativados += r.ativados;
    t.pagantes += r.pagantes;
    out.set(r.utm_content, t);
  }
  return out;
}

// Resumo por chave (canal ou campanha) para o relatório.
export function totalsBy(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = r[key] || '(sem UTM)';
    const t = out[k] || (out[k] = { cadastros: 0, ativados: 0, pagantes: 0 });
    t.cadastros += r.cadastros;
    t.ativados += r.ativados;
    t.pagantes += r.pagantes;
  }
  return out;
}

const fmtTotals = t => `cadastros ${t.cadastros} · ativados ${t.ativados} · pagantes ${t.pagantes}`;

// Bloco do relatório semanal (Telegram, markdown). Vazio quando não há nenhum cadastro.
export function buildFunnelReport({ rows = [], topPosts = [] } = {}) {
  const total = rows.reduce((t, r) => ({
    cadastros: t.cadastros + r.cadastros, ativados: t.ativados + r.ativados, pagantes: t.pagantes + r.pagantes,
  }), { cadastros: 0, ativados: 0, pagantes: 0 });
  if (total.cadastros === 0) return '';
  const lines = ['', '*Funil da Pilar (cadastros dos últimos 7 dias):*', `• Total: ${fmtTotals(total)}`];
  for (const [source, t] of Object.entries(totalsBy(rows, 'utm_source')).sort((a, b) => b[1].ativados - a[1].ativados)) {
    lines.push(`• ${source}: ${fmtTotals(t)}`);
  }
  const campaigns = Object.entries(totalsBy(rows, 'utm_campaign')).filter(([c]) => c !== '(sem UTM)');
  if (campaigns.length) {
    lines.push('', '*Por campanha:*');
    for (const [c, t] of campaigns.sort((a, b) => b[1].ativados - a[1].ativados)) lines.push(`• ${c}: ${fmtTotals(t)}`);
  }
  if (topPosts.length) {
    lines.push('', '*Posts que mais ativaram (120 dias):*');
    for (const p of topPosts) lines.push(`• ${p.channel}: ${(p.hook || '').slice(0, 60)} (ativados ${p.funnel.ativados} · cadastros ${p.funnel.cadastros})`);
  }
  return lines.join('\n');
}
