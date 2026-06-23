// ranking.js — escolhe próximo pilar/ângulo/formato e rankeia variações no timeout.
// Pilar/ângulo: Thompson sampling (bandit.js) quando há sinal de engajamento;
// cold start cai na rotação ponderada por déficit. Chamado por: src/generate.js,
// src/index.js (top-1 no timeout).
//
// Multi-tenant: as funções de escolha recebem a `taxonomy` do tenant
// ({ pillarWeights, angles, formats }). Sem ela, usam a taxonomia DEFAULT (Pilar),
// o que mantém os testes e o caminho single-tenant intactos.

import { thompsonChoose, computePosteriors } from './bandit.js';

// Taxonomia DEFAULT (Pilar). Tenants definem a própria em src/tenant.js; estes
// defaults mantêm as funções utilizáveis sem config (retrocompat + testes).
const PILLAR_WEIGHTS = {
  dor: 0.4,
  dica: 0.3,
  building: 0.15,
  prova: 0.15,
};

const ANGLES = {
  dor: ['financeira', 'tempo', 'versao_arquivo', 'relacional', 'identidade'],
  dica: ['precificacao', 'controle_projeto', 'cobranca', 'documentacao', 'time'],
  building: ['decisao_produto', 'erro_confessado', 'numero_aberto', 'porque_construo', 'proximo_marco'],
  prova: ['citacao_direta', 'antes_depois', 'lista_uso', 'case_curto', 'cliente_dificil'],
};

const FORMATS = ['single', 'carousel'];

// Normaliza a taxonomia recebida: aceita parcial (cai nos defaults Pilar campo a
// campo) ou ausente. Único ponto que conhece os defaults — o resto é genérico.
function withTaxonomy(taxonomy) {
  return {
    pillarWeights: taxonomy?.pillarWeights ?? PILLAR_WEIGHTS,
    angles: taxonomy?.angles ?? ANGLES,
    formats: taxonomy?.formats ?? FORMATS,
  };
}

// Engajamento médio por pilar a partir do histórico (usa item.engagement_score
// gravado pelo coletor de métricas). null = sem dado pra aquele pilar.
export function pillarPerformance(publishedHistory, taxonomy) {
  const { pillarWeights } = withTaxonomy(taxonomy);
  const acc = {};
  for (const p of Object.keys(pillarWeights)) acc[p] = { s: 0, n: 0 };
  for (const item of publishedHistory) {
    const p = item.pillar;
    if (!acc[p]) continue;
    const score = item.engagement_score;
    if (typeof score === 'number') { acc[p].s += score; acc[p].n += 1; }
  }
  const avg = {};
  for (const p of Object.keys(acc)) avg[p] = acc[p].n ? acc[p].s / acc[p].n : null;
  return avg;
}

// Ajusta os pesos-base pela performance real, mantendo um piso (exploração) e
// teto (não deixar um pilar dominar). Sem sinal suficiente, devolve os pesos-base.
export function adaptiveWeights(publishedHistory, taxonomy, { alpha = 0.5, floor = 0.5 } = {}) {
  const base = withTaxonomy(taxonomy).pillarWeights;
  const perf = pillarPerformance(publishedHistory, taxonomy);
  const known = Object.values(perf).filter(v => v != null);
  if (known.length < 2) return { ...base }; // sinal insuficiente → base fixa
  const mean = known.reduce((a, b) => a + b, 0) / known.length;
  if (mean <= 0) return { ...base };

  const adjusted = {};
  let total = 0;
  for (const [pillar, w] of Object.entries(base)) {
    const rel = perf[pillar] != null ? perf[pillar] / mean : 1; // 1 = neutro
    const factor = Math.max(floor, Math.min(1 + alpha * (rel - 1), 1 + alpha));
    adjusted[pillar] = w * factor;
    total += adjusted[pillar];
  }
  for (const pillar of Object.keys(adjusted)) adjusted[pillar] /= total; // normaliza p/ somar 1
  return adjusted;
}

// Posteriores Beta por pilar (puro) — pra snapshot de observabilidade do bandit.
export function pillarPosteriors(publishedHistory, taxonomy) {
  const { pillarWeights } = withTaxonomy(taxonomy);
  return computePosteriors(Object.keys(pillarWeights), publishedHistory, {
    keyField: 'pillar',
    priorWeights: pillarWeights,
    priorStrength: 2,
    halfLifeDays: 30,
  });
}

export function chooseNextPillar(publishedHistory, windowSize = 20, taxonomy) {
  const { pillarWeights } = withTaxonomy(taxonomy);
  const pillars = Object.keys(pillarWeights);

  // Bandit primeiro: com engajamento coletado suficiente, Thompson decide o mix
  // (explora/explota sozinho). O prior informativo (pesos do tenant) mantém o
  // viés estratégico inicial até os dados dominarem.
  const bandit = thompsonChoose(pillars, publishedHistory, {
    keyField: 'pillar',
    priorWeights: pillarWeights,
    priorStrength: 2,
    halfLifeDays: 30,
  });
  if (bandit) return bandit;

  // Cold start (pouco engajamento coletado): rotação ponderada por déficit.
  const weights = adaptiveWeights(publishedHistory, taxonomy);
  const recent = publishedHistory.slice(-windowSize);
  const counts = {};
  for (const p of pillars) counts[p] = 0;

  for (const item of recent) {
    if (item.pillar && counts[item.pillar] !== undefined) {
      counts[item.pillar] += 1;
    }
  }

  const total = recent.length || 1;
  let chosen = pillars[0];
  let maxDeficit = -Infinity;

  for (const [pillar, weight] of Object.entries(weights)) {
    const expected = weight * total;
    const deficit = expected - counts[pillar];
    if (deficit > maxDeficit) {
      maxDeficit = deficit;
      chosen = pillar;
    }
  }

  return chosen;
}

// Escolhe o formato da próxima leva (single/carrossel). Bandit por engajamento
// quando há sinal; no cold start injeta VARIEDADE — quebra sequência monótona do
// mesmo formato. Retorna null = sem preferência (modelo/pilar decide).
export function chooseNextFormat(publishedHistory, { windowSize = 12 } = {}, taxonomy) {
  const { formats } = withTaxonomy(taxonomy);
  // Normaliza: formato vive em post.format (YAML) ou format (DB) — achata pro bandit.
  const hist = (publishedHistory || []).map(p => ({
    format: p.format || p.post?.format,
    engagement_score: p.engagement_score,
    published_at: p.published_at,
  }));
  const bandit = thompsonChoose(formats, hist, { keyField: 'format', priorStrength: 1, halfLifeDays: 45, minScored: 6 });
  if (bandit) return bandit;

  const recent = hist.slice(-windowSize).map(p => p.format).filter(Boolean);
  const lastThree = recent.slice(-3);
  // 3 do formato primário seguidos → varia pro próximo formato (se houver)
  if (lastThree.length === 3 && lastThree.every(f => f === formats[0])) return formats[1] ?? null;
  return null;
}

export function chooseNextAngle(pillar, publishedHistory, windowSize = 30, taxonomy) {
  const { angles: anglesMap } = withTaxonomy(taxonomy);
  const angles = anglesMap[pillar];
  if (!angles) return null;

  // Bandit dentro do pilar: aprende qual ângulo engaja quando há dado.
  // minScored maior (mais arms) e meia-vida mais longa (menos amostras/ângulo).
  const samePillar = publishedHistory.filter(item => item.pillar === pillar);
  const bandit = thompsonChoose(angles, samePillar, {
    keyField: 'angle',
    priorStrength: 1,
    halfLifeDays: 45,
    minScored: 6,
  });
  if (bandit) return bandit;

  // Cold start: rotação — primeiro ângulo não usado recentemente.
  const recentAngles = publishedHistory
    .slice(-windowSize)
    .filter(item => item.pillar === pillar)
    .map(item => item.angle);

  for (const angle of angles) {
    if (!recentAngles.includes(angle)) return angle;
  }

  return angles[0];
}

export function rankVariations(variations) {
  return [...variations]
    .map(v => ({ variation: v, score: scoreVariation(v) }))
    .sort((a, b) => b.score - a.score);
}

function scoreVariation(v) {
  let score = 0;
  const body = v.body || '';
  const hook = v.hook || '';

  const hookLen = hook.length;
  if (hookLen >= 30 && hookLen <= 90) score += 3;
  else if (hookLen > 90 && hookLen <= 120) score += 1;

  const wordCount = body.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 80 && wordCount <= 220) score += 3;
  else if (wordCount > 220 && wordCount <= 280) score += 1;

  const sentences = body.split(/[.!?]/).filter(s => s.trim().length > 0);
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 25);
  score -= longSentences.length * 2;

  const bad = ['sinergia', 'otimizar', 'escalável', 'ecossistema', 'disruptivo', 'imagine só', 'e se eu te dissesse'];
  for (const word of bad) {
    if (body.toLowerCase().includes(word)) score -= 5;
  }

  const concrete = /\b\d+\b/.test(body) || /rev0\d/i.test(body);
  if (concrete) score += 2;

  return score;
}

export const _internal = { PILLAR_WEIGHTS, ANGLES, FORMATS, withTaxonomy, scoreVariation, pillarPerformance, adaptiveWeights };
