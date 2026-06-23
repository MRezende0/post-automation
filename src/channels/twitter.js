// twitter.js — canal X/Twitter. PUBLICAÇÃO REAL PENDENTE de acesso à API:
// o X migrou pra pay-per-use em fev/2026 ($0,015/post, $0,20 com link) e exige
// app + billing. Por ora o canal é GERÁVEL (entra na geração/preview), mas
// publishText/publishThread só operam em dryRun; sem dryRun lançam erro
// explicativo até a API ser plugada. Interface espelha instagram.js/linkedin.js.

const TWEET_LIMIT = 280;

// Divide um texto em tweets respeitando o limite. Quebra por parágrafo; um
// parágrafo grande demais é quebrado por frase. Pura (testável). Sem numeração
// pra não estourar o limite — a ordem da thread já encadeia.
export function splitThread(text, limit = TWEET_LIMIT) {
  const clean = (text || '').trim();
  if (!clean) return [];
  if (clean.length <= limit) return [clean];

  const paragraphs = clean.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const tweets = [];
  let current = '';

  const flush = () => { if (current) { tweets.push(current); current = ''; } };

  for (const para of paragraphs) {
    if (para.length > limit) {
      flush();
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        const piece = sentence.length > limit ? sentence.slice(0, limit) : sentence;
        if (!current) current = piece;
        else if ((`${current} ${piece}`).length <= limit) current = `${current} ${piece}`;
        else { flush(); current = piece; }
      }
    } else if (!current) {
      current = para;
    } else if ((`${current}\n\n${para}`).length <= limit) {
      current = `${current}\n\n${para}`;
    } else {
      flush();
      current = para;
    }
  }
  flush();
  return tweets;
}

const NOT_ENABLED = 'Publicação no X/Twitter ainda não habilitada (API/app review pendente). '
  + 'O canal gera e entra no preview; publique manualmente por ora.';

export async function publishText({ text, imageUrl, dryRun = false }) {
  if (dryRun) {
    return { id: 'mock_tw_post_id', dryRun: true, channel: 'twitter', textLength: text?.length || 0, hasImage: !!imageUrl };
  }
  throw new Error(NOT_ENABLED);
}

export async function publishThread({ tweets, imageUrl, dryRun = false }) {
  if (dryRun) {
    return { id: 'mock_tw_thread_id', dryRun: true, channel: 'twitter', tweets: tweets?.length || 0, hasImage: !!imageUrl };
  }
  throw new Error(NOT_ENABLED);
}

// Insights ainda indisponíveis (sem API). Best-effort: null não quebra a coleta.
export async function getInsights() {
  return null;
}

export const _internal = { TWEET_LIMIT };
