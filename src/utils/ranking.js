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

export function chooseNextPillar(publishedHistory, windowSize = 20) {
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

  for (const [pillar, weight] of Object.entries(PILLAR_WEIGHTS)) {
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

export const _internal = { PILLAR_WEIGHTS, ANGLES, scoreVariation };
