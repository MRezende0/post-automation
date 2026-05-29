// ranking.js — heurística pra escolher próximo pilar/ângulo e pra rankear variações no timeout.
// Chamado por: src/generate.js (escolher pilar), src/index.js (top-1 no timeout).

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

// Engajamento médio por pilar a partir do histórico (usa item.engagement_score
// gravado pelo coletor de métricas). null = sem dado pra aquele pilar.
export function pillarPerformance(publishedHistory) {
  const acc = { dor: { s: 0, n: 0 }, dica: { s: 0, n: 0 }, building: { s: 0, n: 0 }, prova: { s: 0, n: 0 } };
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
export function adaptiveWeights(publishedHistory, base = PILLAR_WEIGHTS, { alpha = 0.5, floor = 0.5 } = {}) {
  const perf = pillarPerformance(publishedHistory);
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

export function chooseNextPillar(publishedHistory, windowSize = 20) {
  const weights = adaptiveWeights(publishedHistory);
  const recent = publishedHistory.slice(-windowSize);
  const counts = { dor: 0, dica: 0, building: 0, prova: 0 };

  for (const item of recent) {
    if (item.pillar && counts[item.pillar] !== undefined) {
      counts[item.pillar] += 1;
    }
  }

  const total = recent.length || 1;
  let chosen = 'dor';
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

export function chooseNextAngle(pillar, publishedHistory, windowSize = 30) {
  const angles = ANGLES[pillar];
  if (!angles) return null;

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

export const _internal = { PILLAR_WEIGHTS, ANGLES, scoreVariation, pillarPerformance, adaptiveWeights };
