import { describe, it, expect } from 'vitest';
import {
  getUpcomingHoliday,
  listUpcomingHolidays,
  holidayContext,
  _internal,
} from '../src/utils/holidays.js';

const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

describe('holidays.js', () => {
  describe('easterSunday', () => {
    it('calcula Páscoa de anos conhecidos', () => {
      expect(_internal.easterSunday(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
      expect(_internal.easterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    });
  });

  describe('blackFriday', () => {
    it('cai sempre na última sexta de novembro', () => {
      const bf = _internal.blackFriday(2026);
      expect(bf.getUTCMonth()).toBe(10); // novembro
      expect(bf.getUTCDay()).toBe(5); // sexta
      expect(bf.getUTCDate()).toBeGreaterThanOrEqual(24);
    });
  });

  describe('getUpcomingHoliday', () => {
    it('detecta feriado fixo dentro da janela', () => {
      const h = getUpcomingHoliday(utc(2026, 12, 8), 7);
      expect(h?.key).toBe('dia_do_engenheiro');
      expect(h.daysUntil).toBe(3);
      expect(h.pillar).toBe('dor');
    });

    it('retorna daysUntil 0 quando hoje é o feriado', () => {
      const h = getUpcomingHoliday(utc(2026, 1, 1), 7);
      expect(h?.key).toBe('ano_novo');
      expect(h.daysUntil).toBe(0);
    });

    it('retorna null quando nada está na janela', () => {
      expect(getUpcomingHoliday(utc(2026, 8, 15), 5)).toBeNull();
    });

    it('cruza a virada de ano (dez → jan)', () => {
      const h = getUpcomingHoliday(utc(2026, 12, 28), 7);
      expect(h?.key).toBe('retrospectiva_ano');
      expect(h.daysUntil).toBe(3);
    });

    it('detecta Carnaval (data móvel via Páscoa)', () => {
      // Carnaval 2026 = terça 17/02.
      const h = getUpcomingHoliday(utc(2026, 2, 12), 7);
      expect(h?.key).toBe('carnaval');
      expect(h.daysUntil).toBe(5);
    });

    it('escolhe o feriado mais próximo quando há mais de um na janela', () => {
      // 11/12 engenheiro e 15/12 arquiteto; ref 10/12, janela 7 → engenheiro primeiro.
      const h = getUpcomingHoliday(utc(2026, 12, 10), 7);
      expect(h?.key).toBe('dia_do_engenheiro');
    });
  });

  describe('listUpcomingHolidays', () => {
    it('lista N próximos em ordem crescente de daysUntil', () => {
      const list = listUpcomingHolidays(utc(2026, 12, 1), 3);
      expect(list).toHaveLength(3);
      expect(list[0].daysUntil).toBeLessThanOrEqual(list[1].daysUntil);
      expect(list.every((h) => h.daysUntil >= 0)).toBe(true);
    });
  });

  describe('holidayContext', () => {
    it('monta linha de contexto com nome e brief', () => {
      const h = getUpcomingHoliday(utc(2026, 12, 11), 7);
      const ctx = holidayContext(h);
      expect(ctx).toContain('Dia do Engenheiro');
      expect(ctx).toContain('hoje');
    });
  });
});
