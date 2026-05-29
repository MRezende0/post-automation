// bandit.js — Thompson sampling sobre arms (pilar ou ângulo).
// Cada arm é uma distribuição Beta(α,β). A recompensa em [0,1] vem do
// engagement_score normalizado (min-max na janela observada), com decaimento
// exponencial por idade: conteúdo velho pesa menos (a audiência muda; o sinal
// não é estacionário). Arms pouco amostrados mantêm a distribuição larga, então
// o Thompson os explora naturalmente — sem precisar de piso de exploração fixo.
//
// Cold start: com pouco engajamento coletado, thompsonChoose devolve null e o
// chamador cai pra rotação determinística (ranking.js).

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Amostra Gamma(k, 1) — Marsaglia-Tsang. Pra k<1 usa o boost u^(1/k).
function sampleGamma(k) {
  if (k < 1) return sampleGamma(1 + k) * Math.pow(Math.random(), 1 / k);
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      x = gaussian();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(alpha, beta) {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x + y === 0 ? 0.5 : x / (x + y);
}

// Constrói os posteriores Beta por arm a partir do histórico. Determinístico
// (testável); a estocasticidade fica só no sampleBeta. Recompensa = score
// normalizado min-max, peso = decaimento exponencial por idade.
export function computePosteriors(arms, posts, {
  keyField = 'pillar',
  priorWeights = null,
  priorStrength = 2,
  halfLifeDays = 30,
  now = Date.now(),
} = {}) {
  const scored = (posts || [])
    .map(p => ({ key: p[keyField], score: p.engagement_score, at: p.published_at }))
    .filter(p => arms.includes(p.key) && typeof p.score === 'number' && Number.isFinite(p.score));

  const values = scored.map(p => p.score);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min;
  const normalize = s => (span > 0 ? (s - min) / span : 0.5);

  const post = {};
  for (const arm of arms) {
    const w = priorWeights ? priorWeights[arm] ?? 1 / arms.length : 1 / arms.length;
    post[arm] = { alpha: 1 + priorStrength * w, beta: 1 + priorStrength * (1 - w), n: 0, reward: 0 };
  }

  for (const p of scored) {
    const ageDays = (now - new Date(p.at).getTime()) / 86400000;
    const decay = Number.isFinite(ageDays) && ageDays > 0 ? Math.pow(0.5, ageDays / halfLifeDays) : 1;
    const r = normalize(p.score);
    post[p.key].alpha += decay * r;
    post[p.key].beta += decay * (1 - r);
    post[p.key].n += 1;
    post[p.key].reward += r;
  }
  return post;
}

// Escolhe um arm via Thompson sampling. Retorna null se não há sinal suficiente
// (menos de minScored posts pontuados) — o chamador cai pro fallback (rotação).
export function thompsonChoose(arms, posts, opts = {}) {
  const { minScored = 4 } = opts;
  const post = computePosteriors(arms, posts, opts);
  const totalScored = Object.values(post).reduce((a, p) => a + p.n, 0);
  if (totalScored < minScored) return null;

  let best = null;
  let bestTheta = -Infinity;
  for (const arm of arms) {
    const theta = sampleBeta(post[arm].alpha, post[arm].beta);
    if (theta > bestTheta) {
      bestTheta = theta;
      best = arm;
    }
  }
  return best;
}

export const _internal = { sampleGamma, gaussian, computePosteriors };
