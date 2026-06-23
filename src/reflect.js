// reflect.js — REFLECTION (npm run reflect). Aprende ESTILO com as edições
// humanas: compara a legenda sugerida (composeCaption da variação gerada) com a
// caption_final editada no cockpit, e via Gemini deriva REGRAS duráveis, salvas
// por tenant em style_rules. As regras entram nas próximas gerações (generate.js).
// Roda por tenant (env TENANT_ID). Best-effort: sem API / sem edições → no-op.

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { usingSupabase, supabase } from './utils/db.js';
import { composeCaption } from './generate.js';
import { hasMeaningfulEdit } from './utils/reflections.js';
import { resolveTenant } from './tenant.js';

const MODEL = 'gemini-2.5-flash';

function log(...args) {
  console.log('[reflect]', ...args);
}

// Coleta pares (sugerido, editado) de scheduled_posts do tenant onde houve
// edição significativa. A legenda sugerida é reconstruída da variação gerada.
async function collectEdits(tenantId, { limit = 40 } = {}) {
  const { data, error } = await supabase()
    .from('scheduled_posts')
    .select('variation,caption_final,channel,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao ler scheduled_posts: ${error.message}`);

  const pairs = [];
  for (const row of data || []) {
    const suggested = composeCaption(row.variation || {});
    const edited = row.caption_final || '';
    if (suggested && edited && hasMeaningfulEdit(suggested, edited)) {
      pairs.push({ channel: row.channel, suggested, edited });
    }
  }
  return pairs;
}

// Gemini extrai regras GENERALIZÁVEIS dos pares. Best-effort → [].
async function deriveStyleRules(pairs, tenant) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !pairs.length) return [];
  const client = new GoogleGenAI({ apiKey });

  const sample = pairs.slice(0, 12)
    .map((p, i) => `Edição ${i + 1} (${p.channel}):\nSUGERIDO: ${p.suggested}\nEDITADO: ${p.edited}`)
    .join('\n\n');

  const prompt = [
    `Você analisa como o editor de ${tenant.name} corrige os posts gerados antes de aprovar.`,
    'Compare SUGERIDO vs EDITADO e extraia REGRAS DE ESTILO que GENERALIZAM — padrões que',
    'se repetem ou refletem claramente a preferência de voz. NÃO inclua correção pontual de',
    'um único post. Seja conservador: no máximo 5 regras, cada uma uma frase imperativa curta.',
    '',
    sample,
    '',
    'Responda só JSON: {"rules":["regra curta 1","regra curta 2"]}',
  ].join('\n');

  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { maxOutputTokens: 600, responseMimeType: 'application/json' },
    });
    const cleaned = (res.text || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed.rules) ? parsed.rules.filter(Boolean).slice(0, 5) : [];
  } catch (e) {
    log(`falha ao derivar regras: ${e.message}`);
    return [];
  }
}

// Snapshot do aprendizado atual: desativa as regras antigas do tenant e grava as
// novas. Mantém histórico (active=false) em vez de apagar.
async function persistRules(tenantId, rules, sampleCount) {
  if (!rules.length) return;
  await supabase().from('style_rules').update({ active: false }).eq('tenant_id', tenantId).eq('active', true);
  const rows = rules.map(rule => ({ tenant_id: tenantId, rule, evidence: { samples: sampleCount } }));
  const { error } = await supabase().from('style_rules').insert(rows);
  if (error) throw new Error(`Falha ao gravar style_rules: ${error.message}`);
}

async function main() {
  const tenant = resolveTenant();
  if (!usingSupabase()) {
    log('STATE_BACKEND≠supabase — reflection precisa do banco (lê scheduled_posts). Saindo.');
    return;
  }
  log(`reflection | tenant=${tenant.id}`);

  const pairs = await collectEdits(tenant.id);
  log(`${pairs.length} edição(ões) significativa(s) encontrada(s)`);
  if (!pairs.length) {
    log('Nada a aprender por ora (aprove editando a legenda no cockpit pra gerar sinal).');
    return;
  }

  const rules = await deriveStyleRules(pairs, tenant);
  log(`${rules.length} regra(s) derivada(s): ${JSON.stringify(rules)}`);
  if (!rules.length) return;

  await persistRules(tenant.id, rules, pairs.length);
  log('Regras atualizadas — entram nas próximas gerações.');
}

main().catch((err) => {
  console.error('[reflect] ERRO:', err);
  process.exit(1);
});
