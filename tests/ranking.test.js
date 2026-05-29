import { describe, it, expect } from 'vitest';
import { chooseNextPillar, chooseNextAngle, rankVariations, _internal } from '../src/utils/ranking.js';

describe('adaptiveWeights', () => {
  it('devolve pesos-base quando há menos de 2 pilares com engajamento', () => {
    const w = _internal.adaptiveWeights([{ pillar: 'dor', engagement_score: 100 }]);
    expect(w).toEqual(_internal.PILLAR_WEIGHTS);
  });

  it('aumenta o peso do pilar que mais engaja (vs base)', () => {
    const history = [
      { pillar: 'dor', engagement_score: 10 },
      { pillar: 'dica', engagement_score: 200 },
      { pillar: 'building', engagement_score: 10 },
      { pillar: 'prova', engagement_score: 10 },
    ];
    const w = _internal.adaptiveWeights(history);
    expect(w.dica).toBeGreaterThan(_internal.PILLAR_WEIGHTS.dica);
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5); // normalizado
  });

  it('respeita o piso de exploração (nenhum peso zera)', () => {
    const history = [
      { pillar: 'dor', engagement_score: 1000 },
      { pillar: 'dica', engagement_score: 0 },
      { pillar: 'building', engagement_score: 0 },
      { pillar: 'prova', engagement_score: 0 },
    ];
    const w = _internal.adaptiveWeights(history);
    for (const v of Object.values(w)) expect(v).toBeGreaterThan(0);
  });
});

describe('ranking.js', () => {
  describe('chooseNextPillar', () => {
    it('escolhe dor quando histórico vazio (maior peso)', () => {
      expect(chooseNextPillar([])).toBe('dor');
    });

    it('escolhe pilar com maior déficit', () => {
      const history = Array(10).fill({ pillar: 'dor' });
      const next = chooseNextPillar(history);
      expect(next).not.toBe('dor');
    });

    it('respeita janela de histórico', () => {
      const old = Array(50).fill({ pillar: 'dor' });
      const recent = Array(5).fill({ pillar: 'building' });
      const history = [...old, ...recent];
      const next = chooseNextPillar(history, 5);
      expect(next).not.toBe('building');
    });
  });

  describe('chooseNextAngle', () => {
    it('escolhe primeiro ângulo não usado recentemente', () => {
      const history = [
        { pillar: 'dor', angle: 'financeira' },
        { pillar: 'dor', angle: 'tempo' },
      ];
      const angle = chooseNextAngle('dor', history);
      expect(['versao_arquivo', 'relacional', 'identidade']).toContain(angle);
    });

    it('retorna null pra pilar desconhecido', () => {
      expect(chooseNextAngle('inexistente', [])).toBeNull();
    });
  });

  describe('rankVariations', () => {
    it('ordena por score, decrescente', () => {
      const variations = [
        { id: 1, hook: 'curto', body: 'corpo curto demais' },
        {
          id: 2,
          hook: 'Hook bom de tamanho ideal entre 30 e 90 caracteres aqui',
          body: 'Frase curta. Outra frase. ' + 'palavra '.repeat(100) + 'Tem Rev04 também.',
        },
        { id: 3, hook: 'Hook ok', body: 'Sinergia disruptiva escalável ecossistema otimizar.' },
      ];
      const ranked = rankVariations(variations);
      expect(ranked[0].variation.id).toBe(2);
      expect(ranked[ranked.length - 1].variation.id).toBe(3);
    });
  });
});
