import { describe, it, expect } from 'vitest';
import { chooseNextPillar, chooseNextAngle, rankVariations } from '../src/utils/ranking.js';

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
