// telegram.js — camada de mensageria do fluxo de aprovação (assíncrono).
//
// Modelo desacoplado em 2 fases:
//   - FASE GERAR (src/index.js): sendApprovalRequest() manda o preview premium
//     (1 mensagem por variação + imagem própria + botões no fim) e retorna os
//     message_ids. NÃO espera decisão — o processo encerra logo em seguida.
//   - FASE RESOLVER (src/resolve.js): fetchDecisions() lê os cliques/textos via
//     getUpdates e confirmDecisions() faz o ack no servidor do Telegram (o offset
//     vive lá, não em arquivo — por isso runs efêmeros não reprocessam cliques).
//
// callback_data carrega o pendingId pra casar a decisão com o post certo mesmo
// com múltiplos canais pendentes ao mesmo tempo: "a:<pid>:<varId>" | "r:<pid>" | "x:<pid>".

import TelegramBot from 'node-telegram-bot-api';

const CAPTION_LIMIT = 1024;
const MESSAGE_LIMIT = 4096;

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

function makeBot() {
  return new TelegramBot(botToken(), { polling: false });
}

// HTML é mais robusto que o Markdown legado: hashtags com underscore
// (#gestao_de_engenharia) e asteriscos soltos não estouram o parser.
function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Quebra texto em pedaços <= max respeitando parágrafo/linha — nunca corta
// no meio de uma palavra (o bug visível no preview antigo).
function chunkText(text, max = MESSAGE_LIMIT) {
  const out = [];
  let buf = '';
  for (const para of String(text).split('\n')) {
    const candidate = buf ? `${buf}\n${para}` : para;
    if (candidate.length <= max) {
      buf = candidate;
      continue;
    }
    if (buf) out.push(buf);
    if (para.length <= max) {
      buf = para;
    } else {
      // Parágrafo único maior que o limite: quebra por palavra.
      let line = '';
      for (const word of para.split(' ')) {
        const c = line ? `${line} ${word}` : word;
        if (c.length <= max) { line = c; continue; }
        if (line) out.push(line);
        line = word;
      }
      buf = line;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function controlRow(pendingId) {
  return [
    { text: '🔄 Regenerar', callback_data: `r:${pendingId}` },
    { text: '❌ Rejeitar', callback_data: `x:${pendingId}` },
  ];
}

// Passo 1: escolher a LEGENDA (texto). callback c:<pid>:<id>.
function buildKeyboard(pendingId, variations) {
  const captionRow = variations.map(v => ({
    text: `📝 #${v.id}`,
    callback_data: `c:${pendingId}:${v.id}`,
  }));
  return { inline_keyboard: [captionRow, controlRow(pendingId)] };
}

// Passo 2: escolher a ARTE. O callback CARREGA a legenda escolhida
// (g:<pid>:<captionId>:<artId>) — stateless, sobrevive entre runs do resolve
// sem precisar persistir a escolha da legenda.
function buildArtKeyboard(pendingId, images, captionId) {
  const artRow = images.map(im => ({
    text: `🖼️ #${im.id}`,
    callback_data: `g:${pendingId}:${captionId}:${im.id}`,
  }));
  return { inline_keyboard: [artRow, controlRow(pendingId)] };
}

// Edita o rodapé pro passo 2 (escolha da arte) após a legenda ser escolhida.
export async function showArtSelection({ messageId, pendingId, images = [], captionId, dryRun = false }) {
  if (dryRun || !messageId) return;
  const bot = makeBot();
  await bot.editMessageText(`📝 Legenda #${captionId} escolhida. Agora a <b>ARTE</b> 🖼️`, {
    chat_id: chatId(),
    message_id: messageId,
    parse_mode: 'HTML',
    reply_markup: buildArtKeyboard(pendingId, images, captionId),
  }).catch(() => {});
}

function formatHeader({ channel, pillar, angle, count }) {
  const lines = [
    `📢 <b>Post pronto — ${escapeHtml(channel.toUpperCase())}</b>`,
    `Pilar: <b>${escapeHtml(pillar)}</b>${angle ? ` · Ângulo: <b>${escapeHtml(angle)}</b>` : ''}`,
    `${count} variações — leia cada uma e escolha nos botões do fim 👇`,
  ];
  return lines.join('\n');
}

function formatVariationCaption(v) {
  return `<b>━━━ Variação ${v.id} ━━━</b>  <i>${escapeHtml(v.format || 'single')}</i>`;
}

function formatVariationBody(v) {
  const hook = v.hook ? `<b>${escapeHtml(v.hook)}</b>\n\n` : '';
  return hook + escapeHtml(v.body || '');
}

// Manda o preview completo e retorna os ids pra fase resolver editar depois.
// images: [{ id, url }] (uma por variação). dryRun curto-circuita pra testes.
export async function sendApprovalRequest({ channel, pillar, angle, variations, pendingId, images = [], dryRun = false }) {
  if (dryRun) {
    return { dryRun: true, pendingId, preview: formatHeader({ channel, pillar, angle, count: variations.length }) };
  }

  const bot = makeBot();
  const cid = chatId();
  const messageIds = [];

  const header = await bot.sendMessage(cid, formatHeader({ channel, pillar, angle, count: variations.length }), {
    parse_mode: 'HTML',
  });
  messageIds.push(header.message_id);

  for (const v of variations) {
    const img = images.find(i => i.id === v.id)?.url;
    if (img) {
      const sent = await bot.sendPhoto(cid, img, {
        caption: formatVariationCaption(v).slice(0, CAPTION_LIMIT),
        parse_mode: 'HTML',
      });
      messageIds.push(sent.message_id);
    } else {
      const sent = await bot.sendMessage(cid, formatVariationCaption(v), { parse_mode: 'HTML' });
      messageIds.push(sent.message_id);
    }
    // Corpo completo em mensagem de texto (4096 chars) — sem o corte de 1024 da caption.
    for (const chunk of chunkText(formatVariationBody(v))) {
      const sent = await bot.sendMessage(cid, chunk, { parse_mode: 'HTML' });
      messageIds.push(sent.message_id);
    }
  }

  const footer = await bot.sendMessage(cid, 'Escolha a <b>LEGENDA</b> 📝 (depois escolhe a arte):', {
    parse_mode: 'HTML',
    reply_markup: buildKeyboard(pendingId, variations),
  });

  return { keyboardMessageId: footer.message_id, messageIds };
}

function parseCallback(data) {
  if (!data) return null;
  const parts = data.split(':');
  const [kind, pendingId, varId, artId] = parts;
  if (kind === 'c') return { action: 'caption', pendingId, chosenCaptionId: parseInt(varId, 10) };
  // g:<pid>:<captionId>:<artId> — a arte carrega a legenda escolhida (stateless)
  if (kind === 'g') return { action: 'art', pendingId, chosenCaptionId: parseInt(varId, 10), chosenArtId: parseInt(artId, 10) };
  if (kind === 'a') return { action: 'approve', pendingId, chosenId: parseInt(varId, 10) }; // compat (1 clique)
  if (kind === 'r') return { action: 'regen', pendingId };
  if (kind === 'x') return { action: 'reject', pendingId };
  return null;
}

// Lê todos os updates não confirmados. NÃO confirma (ack) — isso só acontece em
// confirmDecisions(), depois do processamento bem-sucedido, pra não perder uma
// decisão se o run crashar no meio.
export async function fetchDecisions({ dryRun = false } = {}) {
  if (dryRun) return { decisions: [], texts: [], maxUpdateId: null, callbackAcks: [] };

  const bot = makeBot();
  const cid = String(chatId());
  const updates = await bot.getUpdates({ timeout: 0, allowed_updates: ['callback_query', 'message'] });

  const decisions = [];
  const texts = [];
  const callbackAcks = [];
  let maxUpdateId = null;

  for (const u of updates) {
    maxUpdateId = u.update_id;
    const cb = u.callback_query;
    if (cb) {
      if (String(cb.message?.chat?.id) !== cid) continue;
      const parsed = parseCallback(cb.data);
      if (parsed) {
        decisions.push({ ...parsed, callbackQueryId: cb.id });
        callbackAcks.push(cb.id);
      }
      continue;
    }
    const msg = u.message;
    if (msg && String(msg.chat?.id) === cid && msg.text) {
      texts.push({ text: msg.text, date: msg.date });
    }
  }

  return { decisions, texts, maxUpdateId, callbackAcks };
}

// Confirma os updates no servidor do Telegram (offset = max+1) pra não reentregar
// no próximo run. Também responde os callbacks (best-effort: cliques antigos expiram).
export async function confirmDecisions({ maxUpdateId, callbackAcks = [], dryRun = false }) {
  if (dryRun || maxUpdateId == null) return;
  const bot = makeBot();
  for (const id of callbackAcks) {
    await bot.answerCallbackQuery(id, { text: 'Recebido ✅' }).catch(() => {});
  }
  await bot.getUpdates({ offset: maxUpdateId + 1, timeout: 0 }).catch(() => {});
}

// Substitui a mensagem dos botões pelo resultado final e remove o teclado,
// evitando clique duplo. Best-effort.
export async function finalizeKeyboard({ messageId, text, dryRun = false }) {
  if (dryRun || !messageId) return;
  const bot = makeBot();
  await bot.editMessageText(text, {
    chat_id: chatId(),
    message_id: messageId,
    parse_mode: 'HTML',
  }).catch(() => {});
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
    chat_id: chatId(),
    message_id: messageId,
  }).catch(() => {});
}

export async function notify(text, opts = {}) {
  if (opts.dryRun) return { dryRun: true, text };
  const bot = makeBot();
  return bot.sendMessage(chatId(), text, { parse_mode: 'HTML' });
}

export { escapeHtml };
export const _internal = { escapeHtml, chunkText, buildKeyboard, buildArtKeyboard, parseCallback, formatHeader, formatVariationBody };
