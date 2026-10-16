// score.js — score de engajamento ponderado e normalizado por alcance.
// Substitui a soma bruta (sumMetrics): em B2B salvamento e compartilhamento
// valem mais que like (vaidade), e 10 saves em 100 de alcance ≠ 10 em 10.000.
// Sem alcance disponível, cai pra soma ponderada bruta.
//
// Campos por canal (best-effort, null quando indisponível):
//   instagram → { likes, comments, reach, saved }
//   linkedin  → { likes, comments, impressions }

const WEIGHTS = { saves: 4, shares: 4, comments: 3, likes: 1 };

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// metrics: { instagram: {...}, linkedin: {...}, collected_at: '...' }
export function engagementScore(metrics) {
  if (!metrics || typeof metrics !== 'object') return 0;
  let weighted = 0;
  let reach = 0;
  for (const ch of Object.values(metrics)) {
    if (!ch || typeof ch !== 'object') continue; // pula collected_at (string)
    const saves = num(ch.saved) + num(ch.saves);
    const shares = num(ch.shares);
    const comments = num(ch.comments);
    const likes = num(ch.likes);
    weighted += saves * WEIGHTS.saves + shares * WEIGHTS.shares + comments * WEIGHTS.comments + likes * WEIGHTS.likes;
    reach += num(ch.reach) + num(ch.impressions);
  }
  // Engajamento por mil de alcance — comparável entre posts de alcances diferentes.
  if (reach > 0) return Math.round((weighted / reach) * 1000);
  return weighted; // sem alcance: soma ponderada bruta (melhor que nada)
}

// Pontos do funil da Pilar, na mesma escala do engajamento por mil de alcance (SPEC 004).
// Um ativado vale 50: o objetivo do lançamento é cadastro ativado, não curtida.
const FUNNEL_POINTS = { cadastros: 10, ativados: 50, pagantes: 200 };

export function funnelPoints(funnel) {
  if (!funnel || typeof funnel !== 'object') return 0;
  return num(funnel.cadastros) * FUNNEL_POINTS.cadastros
    + num(funnel.ativados) * FUNNEL_POINTS.ativados
    + num(funnel.pagantes) * FUNNEL_POINTS.pagantes;
}

// Recompensa usada pelo bandit: engajamento + funil. null quando o post não tem nenhum sinal.
export function rewardScore(post) {
  const engagement = typeof post?.engagement_score === 'number' && Number.isFinite(post.engagement_score)
    ? post.engagement_score
    : null;
  const points = funnelPoints(post?.funnel);
  if (engagement == null && points === 0) return null;
  return (engagement ?? 0) + points;
}

export const _internal = { WEIGHTS, FUNNEL_POINTS, num };
