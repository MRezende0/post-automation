// thread.ts: quebra a legenda do X em tweets. Puro e sem I/O, então serve tanto ao
// scheduler (channels/x.ts) quanto à prévia no cliente (ApproveForm).

export const TWEET_LIMIT = 280;

// Divide o texto em tweets. Porta fiel de src/channels/twitter.js:splitThread: quebra
// por parágrafo; parágrafo grande demais é quebrado por frase. Sem numeração.
export function splitThread(text: string, limit = TWEET_LIMIT): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  if (clean.length <= limit) return [clean];

  const paragraphs = clean.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const tweets: string[] = [];
  let current = '';
  const flush = () => {
    if (current) {
      tweets.push(current);
      current = '';
    }
  };

  for (const para of paragraphs) {
    if (para.length > limit) {
      flush();
      for (const sentence of para.split(/(?<=[.!?])\s+/)) {
        const piece = sentence.length > limit ? sentence.slice(0, limit) : sentence;
        if (!current) current = piece;
        else if (`${current} ${piece}`.length <= limit) current = `${current} ${piece}`;
        else {
          flush();
          current = piece;
        }
      }
    } else if (!current) {
      current = para;
    } else if (`${current}\n\n${para}`.length <= limit) {
      current = `${current}\n\n${para}`;
    } else {
      flush();
      current = para;
    }
  }
  flush();
  return tweets;
}
