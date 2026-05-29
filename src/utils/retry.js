// retry.js — backoff exponencial pra falhas transitórias de API (throttle/5xx/rede).
// Meta e LinkedIn dão 429/5xx com frequência; uma falha transitória não deve
// matar a publicação. NÃO usar no passo final de publish (risco de post duplicado).

const TRANSIENT_STATUS = [429, 500, 502, 503, 504];

export function isTransient(err) {
  if (err?.status && TRANSIENT_STATUS.includes(err.status)) return true;
  const m = String(err?.message || '');
  if (/\b(429|500|502|503|504)\b/.test(m)) return true;
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|fetch failed|socket hang up|network/i.test(m);
}

export async function withRetry(fn, { tries = 3, baseMs = 500, label = 'api' } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === tries - 1) throw err;
      const delay = baseMs * 2 ** i + Math.floor(Math.random() * 100); // jitter
      console.error(`[retry] ${label} tentativa ${i + 1}/${tries} falhou (${err.message}); aguardando ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
