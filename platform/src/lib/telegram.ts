// Telegram — APENAS notificações (sem botões/aprovação). A aprovação migrou pra
// plataforma; o bot agora só avisa: nova pendência, agendado, publicado, falhou.

function escapeHtml(s = ''): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function notify(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // sem credenciais → silencioso (não derruba o fluxo)
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch {
    // notificação é best-effort — nunca quebra a publicação/agendamento
  }
}

export { escapeHtml };
