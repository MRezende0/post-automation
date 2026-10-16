import { describe, it, expect } from 'vitest';
import { createBot, TelegramError } from '../src/utils/telegram-api.js';

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), method: init.method });
    const r = responses.shift();
    return { ok: r.status ? r.status < 400 : true, status: r.status ?? 200, json: async () => r.body };
  };
  return { calls, impl };
}

describe('telegram-api', () => {
  it('sendMessage posta JSON no método certo e devolve o result', async () => {
    const f = fakeFetch([{ body: { ok: true, result: { message_id: 7 } } }]);
    const bot = createBot('TOKEN', { fetchImpl: f.impl });
    const sent = await bot.sendMessage('123', 'oi <b>x</b>', { parse_mode: 'HTML' });
    expect(sent.message_id).toBe(7);
    expect(f.calls[0].url).toBe('https://api.telegram.org/botTOKEN/sendMessage');
    expect(f.calls[0].method).toBe('POST');
    expect(f.calls[0].body).toEqual({ chat_id: '123', text: 'oi <b>x</b>', parse_mode: 'HTML' });
  });

  it('as assinaturas dos outros métodos montam o payload esperado', async () => {
    const ok = { body: { ok: true, result: true } };
    const f = fakeFetch([ok, ok, ok, ok, { body: { ok: true, result: [{ update_id: 1 }] } }]);
    const bot = createBot('T', { fetchImpl: f.impl });
    await bot.sendPhoto('1', 'https://x/y.png', { caption: 'c' });
    await bot.editMessageText('novo', { chat_id: '1', message_id: 9 });
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: '1', message_id: 9 });
    await bot.answerCallbackQuery('cb1', { text: 'Recebido' });
    const updates = await bot.getUpdates({ offset: 5, timeout: 0 });
    expect(f.calls.map((c) => c.url.split('/').pop())).toEqual([
      'sendPhoto', 'editMessageText', 'editMessageReplyMarkup', 'answerCallbackQuery', 'getUpdates',
    ]);
    expect(f.calls[0].body).toEqual({ chat_id: '1', photo: 'https://x/y.png', caption: 'c' });
    expect(f.calls[2].body).toEqual({ reply_markup: { inline_keyboard: [] }, chat_id: '1', message_id: 9 });
    expect(f.calls[3].body).toEqual({ callback_query_id: 'cb1', text: 'Recebido' });
    expect(updates).toEqual([{ update_id: 1 }]);
  });

  it('erro da API vira TelegramError com a descrição, sem o token', async () => {
    const f = fakeFetch([{ status: 400, body: { ok: false, error_code: 400, description: 'Bad Request: chat not found' } }]);
    const bot = createBot('SEGREDO', { fetchImpl: f.impl });
    const err = await bot.sendMessage('1', 'x').catch((e) => e);
    expect(err).toBeInstanceOf(TelegramError);
    expect(err.message).toBe('Telegram sendMessage: Bad Request: chat not found');
    expect(err.message).not.toContain('SEGREDO');
    expect(err.code).toBe(400);
  });

  it('resposta que não é JSON ainda falha com o status HTTP', async () => {
    const impl = async () => ({ ok: false, status: 502, json: async () => { throw new Error('html'); } });
    const err = await createBot('T', { fetchImpl: impl }).getUpdates().catch((e) => e);
    expect(err.message).toBe('Telegram getUpdates: HTTP 502');
  });
});
