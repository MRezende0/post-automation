// telegram-api.js: cliente mínimo da Bot API do Telegram sobre fetch. Cobre só os seis
// métodos que o fluxo usa e mantém as assinaturas da lib que substituiu (node-telegram-bot-api,
// que arrastava o `request`, descontinuado e com vulnerabilidade crítica).

const API = 'https://api.telegram.org';

export class TelegramError extends Error {
  constructor(method, description, code) {
    super(`Telegram ${method}: ${description}`);
    this.code = code;
  }
}

export function createBot(token, { fetchImpl = fetch } = {}) {
  async function call(method, payload = {}) {
    const res = await fetchImpl(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new TelegramError(method, body?.description || `HTTP ${res.status}`, body?.error_code ?? res.status);
    return body.result;
  }

  return {
    sendMessage: (chat_id, text, opts = {}) => call('sendMessage', { chat_id, text, ...opts }),
    sendPhoto: (chat_id, photo, opts = {}) => call('sendPhoto', { chat_id, photo, ...opts }),
    editMessageText: (text, opts = {}) => call('editMessageText', { text, ...opts }),
    editMessageReplyMarkup: (reply_markup, opts = {}) => call('editMessageReplyMarkup', { reply_markup, ...opts }),
    answerCallbackQuery: (callback_query_id, opts = {}) => call('answerCallbackQuery', { callback_query_id, ...opts }),
    getUpdates: (opts = {}) => call('getUpdates', opts),
  };
}
