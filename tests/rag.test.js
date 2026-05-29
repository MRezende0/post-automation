import { describe, it, expect } from 'vitest';
import { _internal } from '../src/utils/rag.js';

const { chunkText, cosineSim } = _internal;

describe('rag.js', () => {
  describe('chunkText', () => {
    it('texto curto vira um único chunk', () => {
      expect(chunkText('uma linha só')).toEqual(['uma linha só']);
    });

    it('agrupa parágrafos respeitando maxChars', () => {
      const p = 'x'.repeat(500);
      const chunks = chunkText(`${p}\n\n${p}\n\n${p}`, { maxChars: 800 });
      expect(chunks.length).toBe(3); // cada parágrafo de 500 não cabe junto em 800
    });

    it('junta parágrafos pequenos no mesmo chunk', () => {
      const chunks = chunkText('a\n\nb\n\nc', { maxChars: 800 });
      expect(chunks).toEqual(['a\n\nb\n\nc']);
    });
  });

  describe('cosineSim', () => {
    it('vetores idênticos → 1', () => {
      expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
    });

    it('vetores ortogonais → 0', () => {
      expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0, 6);
    });

    it('vetor zero → 0 (sem divisão por zero)', () => {
      expect(cosineSim([0, 0], [1, 1])).toBe(0);
    });
  });
});
