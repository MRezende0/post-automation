// gemini.ts: chamada direta ao Gemini (REST, sem SDK) pra rascunhos interativos da
// plataforma, que não podem esperar o cron. Server-only: a chave nunca vai pro browser.

import { UserError } from './errors';

const MODEL = process.env.GEMINI_MODEL_ENGAGE || 'gemini-2.5-flash';

export async function generateJson(prompt: string, { maxOutputTokens = 800 } = {}): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY ausente na plataforma (configure na Vercel).');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new UserError('O Gemini devolveu algo que não é JSON. Tente gerar de novo.');
  }
}
