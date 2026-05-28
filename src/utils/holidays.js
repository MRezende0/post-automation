// holidays.js — calendário de datas relevantes pro nicho (engenharia B2B BR).
// Chamado por: src/index.js (injeta post temático quando a data se aproxima).
// Cada data sugere pilar + ângulo + brief de como abordar — o orquestrador passa
// isso como `context`/`pillar`/`angle` pra geração só quando a fila está vazia.

// Feriados/datas fixas. `pillar` precisa ser um dos válidos: dor | dica | building | prova.
const FIXED = [
  {
    key: 'ano_novo',
    name: 'Ano Novo',
    month: 1,
    day: 1,
    pillar: 'building',
    angle: 'numero_aberto',
    brief:
      'Virada de ano. Faça uma retrospectiva honesta do escritório: o que travou em 2025, qual decisão de gestão você mudaria, qual a meta concreta pra 2026. Números abertos batem mais que desejo genérico de "feliz ano novo".',
  },
  {
    key: 'dia_da_agua',
    name: 'Dia Mundial da Água',
    month: 3,
    day: 22,
    pillar: 'dica',
    angle: 'documentacao',
    brief:
      'Dia Mundial da Água. Gancho pra projetos hidrossanitários/saneamento: dica concreta sobre documentação, dimensionamento ou compliance hídrico. Evite ecochavão — fale do problema técnico real do escritório.',
  },
  {
    key: 'dia_do_trabalhador',
    name: 'Dia do Trabalhador',
    month: 5,
    day: 1,
    pillar: 'dor',
    angle: 'tempo',
    brief:
      'Dia do Trabalhador, feriado. Ironia útil: o dono do escritório é quem menos folga. Nomeie a dor de tempo (domingo administrando, 23h no escritório). Sem pieguice.',
  },
  {
    key: 'dia_do_empreendedor',
    name: 'Dia do Empreendedor',
    month: 10,
    day: 5,
    pillar: 'building',
    angle: 'porque_construo',
    brief:
      'Dia do Empreendedor. Por que você decidiu construir/empreender no setor de engenharia. Vulnerável-confiante: o problema que te incomodava tanto que virou produto.',
  },
  {
    key: 'dia_do_engenheiro',
    name: 'Dia do Engenheiro',
    month: 12,
    day: 11,
    pillar: 'dor',
    angle: 'identidade',
    brief:
      'Dia do Engenheiro (11/12). Dor de identidade: virou gestor sem querer e não consegue mais "ser engenheiro" — vive no administrativo. Reconhecimento + a dor de quem se afastou da técnica.',
  },
  {
    key: 'dia_do_arquiteto',
    name: 'Dia do Arquiteto e Urbanista',
    month: 12,
    day: 15,
    pillar: 'prova',
    angle: 'lista_uso',
    brief:
      'Dia do Arquiteto e Urbanista (15/12). Fale com o público de arquitetura: como escritórios de arquitetura usam o produto, casos concretos de organização de projeto/RT.',
  },
  {
    key: 'natal',
    name: 'Natal',
    month: 12,
    day: 25,
    pillar: 'building',
    angle: 'porque_construo',
    brief:
      'Natal. Mensagem curta e humana, sem corporativês. Pode agradecer clientes/seguidores nomeando algo específico que aprendeu com eles no ano. Nada de cartão genérico.',
  },
  {
    key: 'retrospectiva_ano',
    name: 'Retrospectiva de fim de ano',
    month: 12,
    day: 31,
    pillar: 'building',
    angle: 'numero_aberto',
    brief:
      'Último dia do ano. Retrospectiva com números abertos do produto/escritório: MRR, nº de clientes, feature que deu certo, aposta que falhou. Honestidade > vitrine.',
  },
];

// Algoritmo de Meeus/Jones/Butcher pra Domingo de Páscoa (calendário gregoriano).
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

// Última sexta-feira de novembro (Black Friday no padrão BR).
function blackFriday(year) {
  const lastDay = new Date(Date.UTC(year, 11, 0)); // 30/nov
  const dow = lastDay.getUTCDay(); // 0=dom ... 5=sex 6=sáb
  const offset = (dow - 5 + 7) % 7;
  return addDays(lastDay, -offset);
}

// Datas móveis derivadas da Páscoa / regra de calendário.
function movableFor(year) {
  const easter = easterSunday(year);
  return [
    {
      key: 'carnaval',
      name: 'Carnaval',
      date: addDays(easter, -47), // terça-feira de Carnaval
      pillar: 'dor',
      angle: 'tempo',
      brief:
        'Carnaval. Escritório fecha, mas a obra e o cliente não param. Dor de tempo / de não conseguir desconectar de verdade — o celular cheio de mensagem de obra no feriado.',
    },
    {
      key: 'black_friday',
      name: 'Black Friday',
      date: blackFriday(year),
      pillar: 'prova',
      angle: 'case_curto',
      brief:
        'Black Friday — única janela do ano em que CTA de oferta é esperado. Prova social + condição especial. Seja específico no benefício (o que muda na rotina do escritório), não só no desconto.',
    },
  ];
}

function fixedFor(year) {
  return FIXED.map((h) => ({
    key: h.key,
    name: h.name,
    date: new Date(Date.UTC(year, h.month - 1, h.day)),
    pillar: h.pillar,
    angle: h.angle,
    brief: h.brief,
  }));
}

function occurrencesFor(year) {
  return [...fixedFor(year), ...movableFor(year)];
}

function atUtcMidnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Retorna o feriado mais próximo dentro da janela (hoje incluso), ou null.
 * @param {Date} [today] - referência (default: agora).
 * @param {number} [windowDays] - dias de antecedência a considerar (default: 7).
 * @returns {{key,name,date,daysUntil,pillar,angle,brief}|null}
 */
export function getUpcomingHoliday(today = new Date(), windowDays = 7) {
  const ref = atUtcMidnight(today);
  const year = ref.getUTCFullYear();
  // Cobre virada de ano: ocorrências deste ano e do próximo.
  const candidates = [...occurrencesFor(year), ...occurrencesFor(year + 1)];

  let best = null;
  for (const h of candidates) {
    const daysUntil = Math.round((atUtcMidnight(h.date).getTime() - ref.getTime()) / 86400000);
    if (daysUntil < 0 || daysUntil > windowDays) continue;
    if (!best || daysUntil < best.daysUntil) {
      best = { ...h, daysUntil };
    }
  }
  return best;
}

/** Lista próximos N feriados a partir de hoje — útil pra planejar a fila. */
export function listUpcomingHolidays(today = new Date(), count = 5) {
  const ref = atUtcMidnight(today);
  const year = ref.getUTCFullYear();
  return [...occurrencesFor(year), ...occurrencesFor(year + 1)]
    .map((h) => ({
      ...h,
      daysUntil: Math.round((atUtcMidnight(h.date).getTime() - ref.getTime()) / 86400000),
    }))
    .filter((h) => h.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, count);
}

/** Monta a linha de contexto que vai pro prompt de geração. */
export function holidayContext(holiday) {
  const quando = holiday.daysUntil === 0 ? 'hoje' : `em ${holiday.daysUntil} dia(s)`;
  return `POST TEMÁTICO — ${holiday.name} (${quando}). ${holiday.brief}`;
}

export const _internal = { easterSunday, blackFriday, movableFor, occurrencesFor, FIXED };
