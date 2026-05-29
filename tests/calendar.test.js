import { describe, it, expect } from 'vitest';
import { campaignContext, _internal } from '../src/utils/calendar.js';

const { pickActiveCampaign } = _internal;
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

describe('calendar.js', () => {
  describe('pickActiveCampaign', () => {
    const camps = [
      { name: 'Lançamento Portal', start: '2026-06-01', end: '2026-06-07', pillar: 'building' },
      { name: 'Sempre-on', context: 'institucional' },
    ];

    it('pega a campanha cujo intervalo contém hoje', () => {
      expect(pickActiveCampaign(camps, utc(2026, 6, 3))?.name).toBe('Lançamento Portal');
    });

    it('inclui as bordas (start e end)', () => {
      expect(pickActiveCampaign(camps, utc(2026, 6, 1))?.name).toBe('Lançamento Portal');
      expect(pickActiveCampaign(camps, utc(2026, 6, 7))?.name).toBe('Lançamento Portal');
    });

    it('cai na campanha sem datas quando a datada não está ativa', () => {
      expect(pickActiveCampaign(camps, utc(2026, 7, 1))?.name).toBe('Sempre-on');
    });

    it('retorna null quando nenhuma campanha se aplica', () => {
      const only = [{ name: 'X', start: '2026-06-01', end: '2026-06-07' }];
      expect(pickActiveCampaign(only, utc(2026, 5, 1))).toBeNull();
    });

    it('respeita a ordem (primeira ativa vence)', () => {
      const two = [
        { name: 'A', start: '2026-06-01', end: '2026-06-30' },
        { name: 'B', start: '2026-06-05', end: '2026-06-10' },
      ];
      expect(pickActiveCampaign(two, utc(2026, 6, 6))?.name).toBe('A');
    });
  });

  describe('campaignContext', () => {
    it('monta a linha de contexto', () => {
      const ctx = campaignContext({ name: 'Lançamento', context: 'tema X' });
      expect(ctx).toContain('CAMPANHA — Lançamento');
      expect(ctx).toContain('tema X');
    });
  });
});
