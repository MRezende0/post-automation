// reflections.js — aprendizado de ESTILO a partir das edições humanas.
// hasMeaningfulEdit / buildReflectionBlock são puros (testáveis).
// getActiveStyleRules lê as regras ativas do tenant (best-effort: sem DB → []).

import { usingSupabase, supabase } from './db.js';

// Normaliza pra comparar CONTEÚDO, não formatação: minúsculas, espaços colapsados.
function normalize(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Levenshtein iterativo (duas linhas). O(n·m) — ok pra captions e batches pequenos.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

// Edição "significativa" = mudou além de um limiar relativo (ignora ajuste de
// espaço/hashtag). Curto-circuita pela diferença de comprimento antes do O(n·m).
export function hasMeaningfulEdit(original, edited, { minRatio = 0.08 } = {}) {
  const a = normalize(original);
  const b = normalize(edited);
  if (!a || !b || a === b) return false;
  const maxLen = Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) / maxLen >= minRatio) return true;
  return levenshtein(a, b) / maxLen >= minRatio;
}

// Monta o bloco injetado no system prompt. Vazio se não há regras.
export function buildReflectionBlock(rules) {
  const list = (rules || []).map(r => (typeof r === 'string' ? r : r?.rule)).filter(Boolean);
  if (!list.length) return '';
  return `## Regras aprendidas com edições anteriores (siga à risca)\n\n${list.map(r => `- ${r}`).join('\n')}`;
}

// Lê as regras de estilo ativas do tenant. Best-effort: sem DB → []. Filtra por
// canal (regra sem canal vale pra todos).
export async function getActiveStyleRules(tenantId, { channel, limit = 12 } = {}) {
  if (!usingSupabase()) return [];
  try {
    const { data, error } = await supabase()
      .from('style_rules')
      .select('rule,channel')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data || [])
      .filter(r => !r.channel || !channel || r.channel === channel)
      .map(r => r.rule);
  } catch (e) {
    return [];
  }
}

export const _internal = { normalize, levenshtein };
