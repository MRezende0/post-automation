// notifications.ts: avisos da conta (SPEC 007), gravados em `notifications` e lidos pela tela.
// Substitui o Telegram. Best-effort: aviso que não grava vai para o log e nunca derruba a
// publicação nem o agendamento. Texto puro, sem HTML: quem mostra escapa.

import type { TenantDb } from './tenant-db';
import { log } from './log';

export type NoticeLevel = 'info' | 'warning' | 'error';

export type Notice = {
  kind: string;
  level?: NoticeLevel;
  title: string;
  body?: string;
  link?: string;
};

const TITLE_MAX = 200;
const CHANNEL_NAMES: Record<string, string> = { instagram: 'Instagram', linkedin: 'LinkedIn', twitter: 'X' };

export function channelName(channel: string): string {
  return CHANNEL_NAMES[channel] ?? channel;
}

export async function notify(t: TenantDb, n: Notice): Promise<void> {
  const row = {
    kind: n.kind,
    level: n.level ?? 'info',
    title: n.title.slice(0, TITLE_MAX),
    body: n.body ?? null,
    link: n.link?.startsWith('/') ? n.link : null,
  };
  try {
    const { error } = await t.insert('notifications', row);
    if (error) log('warn', 'notifications', 'aviso não gravado', { tenant: t.tenantId, kind: n.kind, error: error.message });
  } catch (e) {
    log('warn', 'notifications', 'aviso não gravado', { tenant: t.tenantId, kind: n.kind, error: e instanceof Error ? e.message : String(e) });
  }
}
