// Formatação de datas no fuso editorial (offset fixo). Pura — client e server.
// NEXT_PUBLIC_PUBLISH_TZ_OFFSET é exposto ao client; cai pra -3 (BRT).

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function tzOffset(): number {
  const v = Number(process.env.NEXT_PUBLIC_PUBLISH_TZ_OFFSET ?? process.env.PUBLISH_TZ_OFFSET ?? -3);
  return Number.isFinite(v) ? v : -3;
}

function localParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + tzOffset() * 3600 * 1000);
  return {
    weekday: d.getUTCDay(),
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDateTime(iso: string): string {
  const p = localParts(iso);
  return `${DIAS_CURTO[p.weekday]} ${pad(p.day)}/${pad(p.month)} · ${pad(p.hour)}:${pad(p.minute)}`;
}

export function fmtDate(iso: string): string {
  const p = localParts(iso);
  return `${pad(p.day)}/${pad(p.month)}/${p.year}`;
}

export function fmtTime(iso: string): string {
  const p = localParts(iso);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function weekdayName(n: number, short = false): string {
  return (short ? DIAS_CURTO : DIAS)[n] ?? String(n);
}

// converte um datetime-local (sem tz, interpretado no fuso editorial) pra ISO UTC
export function localInputToIso(value: string): string {
  // value: "2026-06-03T18:00"
  const [date, time] = value.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm) - tzOffset() * 3600 * 1000;
  return new Date(utcMs).toISOString();
}

// ISO UTC → valor pra <input type="datetime-local"> no fuso editorial
export function isoToLocalInput(iso: string): string {
  const p = localParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
