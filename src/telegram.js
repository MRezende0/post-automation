// telegram.js — envia preview de 3 variações + imagem + botões inline. Aguarda decisão.
// Chamado por: src/index.js. Bot precisa estar online durante a janela de 90min.
//
// Fluxo:
//   1. sendApprovalRequest(variations, imagePath) → manda preview e botões
//   2. waitForDecision(timeoutMs) → polling de updates até botão clicado OU timeout
//   3. retorna { action, chosenId, reason } onde action ∈ aprovar|regenerar|rejeitar|timeout

import TelegramBot from 'node-telegram-bot-api';
import { existsSync } from 'node:fs';

function botToken() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN ausente');
  return t;
}

function chatId() {
  const c = process.env.TELEGRAM_CHAT_ID;
  if (!c) throw new Error('TELEGRAM_CHAT_ID ausente');
  return c;
}

function buildKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '✅ Aprovar #1', callback_data: 'approve:1' },
        { text: '✅ Aprovar #2', callback_data: 'approve:2' },
        { text: '✅ Aprovar #3', callback_data: 'approve:3' },
      ],
      [
        { text: '🔄 Regenerar', callback_data: 'regen' },
        { text: '❌ Rejeitar', callback_data: 'reject' },
      ],
    ],
  };
}

function formatPreview({ channel, pillar, angle, variations }) {
  const head = `*📢 Post pronto — ${channel.toUpperCase()} / ${pillar}${angle ? ' / ' + angle : ''}*\n`;
  const blocks = variations.map(v => {
    const body = (v.body || '').slice(0, 700);
    return `\n*— Variação ${v.id} —*\n${body}`;
  }).join('\n');
  return head + blocks;
}

export async function sendApprovalRequest({ channel, pillar, angle, variations, imagePath, imageUrl, dryRun = false }) {
  if (dryRun) {
    return {
      messageId: 'mock_msg_id',
      dryRun: true,
      preview: formatPreview({ channel, pillar, angle, variations }).slice(0, 200),
    };
  }

  const bot = new TelegramBot(botToken(), { polling: false });
  const cid = chatId();
  const caption = formatPreview({ channel, pillar, angle, variations });

  const photo = imageUrl || (imagePath && existsSync(imagePath) ? imagePath : null);

  let messageId;
  if (photo) {
    const truncated = caption.length > 1024 ? caption.slice(0, 1020) + '...' : caption;
    const sent = await bot.sendPhoto(cid, photo, {
      caption: truncated,
      parse_mode: 'Markdown',
      reply_markup: buildKeyboard(),
    });
    messageId = sent.message_id;
    if (caption.length > 1024) {
      await bot.sendMessage(cid, '*Variações completas:*\n' + caption.slice(1020), { parse_mode: 'Markdown' });
    }
  } else {
    const sent = await bot.sendMessage(cid, caption, {
      parse_mode: 'Markdown',
      reply_markup: buildKeyboard(),
    });
    messageId = sent.message_id;
  }

  return { messageId, botInstance: bot };
}

export async function waitForDecision({ botInstance, messageId, timeoutMs = 90 * 60 * 1000, pollIntervalMs = 5000, dryRun = false }) {
  if (dryRun) {
    return { action: 'timeout', chosenId: null, reason: 'dry-run' };
  }

  const bot = botInstance || new TelegramBot(botToken(), { polling: false });
  const cid = chatId();
  const deadline = Date.now() + timeoutMs;
  let offset = 0;

  while (Date.now() < deadline) {
    const updates = await bot.getUpdates({ offset, timeout: 1 });

    for (const update of updates) {
      offset = update.update_id + 1;
      const cb = update.callback_query;
      if (!cb) continue;
      if (String(cb.message?.chat?.id) !== String(cid)) continue;

      const data = cb.data;
      await bot.answerCallbackQuery(cb.id, { text: 'Recebido' });

      if (data.startsWith('approve:')) {
        const id = parseInt(data.split(':')[1], 10);
        return { action: 'approve', chosenId: id };
      }
      if (data === 'regen') return { action: 'regen', chosenId: null };
      if (data === 'reject') {
        await bot.sendMessage(cid, 'Por favor envie o motivo da rejeição (próxima mensagem texto). Tempo: 5min.');
        const reason = await collectReasonMessage({ bot, cid, offset, timeoutMs: 5 * 60 * 1000 });
        return { action: 'reject', chosenId: null, reason };
      }
    }

    await sleep(pollIntervalMs);
  }

  return { action: 'timeout', chosenId: null };
}

async function collectReasonMessage({ bot, cid, offset, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  let off = offset;
  while (Date.now() < deadline) {
    const updates = await bot.getUpdates({ offset: off, timeout: 1 });
    for (const u of updates) {
      off = u.update_id + 1;
      const msg = u.message;
      if (msg && String(msg.chat?.id) === String(cid) && msg.text) {
        return msg.text;
      }
    }
    await sleep(3000);
  }
  return 'sem motivo informado';
}

export async function notify(text, opts = {}) {
  if (opts.dryRun) {
    return { dryRun: true, text };
  }
  const bot = new TelegramBot(botToken(), { polling: false });
  return bot.sendMessage(chatId(), text, { parse_mode: 'Markdown' });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export const _internal = { formatPreview, buildKeyboard };
