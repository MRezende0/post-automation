import { describe, it, expect } from 'vitest';
import { engagementScore } from '../src/utils/score.js';

describe('engagementScore', () => {
  it('vazio/inválido → 0', () => {
    expect(engagementScore(null)).toBe(0);
    expect(engagementScore({})).toBe(0);
    expect(engagementScore('nope')).toBe(0);
  });

  it('ignora collected_at (string) sem quebrar', () => {
    const m = { instagram: { likes: 10, reach: 1000 }, collected_at: '2026-05-29T00:00:00Z' };
    expect(engagementScore(m)).toBeGreaterThan(0);
  });

  it('saves pesam mais que likes (mesmo alcance)', () => {
    const comSaves = engagementScore({ instagram: { saved: 10, reach: 1000 } });
    const comLikes = engagementScore({ instagram: { likes: 10, reach: 1000 } });
    expect(comSaves).toBeGreaterThan(comLikes);
  });

  it('normaliza por alcance: mesmo engajamento, menor alcance → score maior', () => {
    const baixoAlcance = engagementScore({ instagram: { saved: 10, reach: 100 } });
    const altoAlcance = engagementScore({ instagram: { saved: 10, reach: 10000 } });
    expect(baixoAlcance).toBeGreaterThan(altoAlcance);
  });

  it('sem alcance → soma ponderada bruta (não divide por zero)', () => {
    // saved*4 + comments*3 + likes*1 = 4 + 6 + 5 = 15
    const score = engagementScore({ linkedin: { likes: 5, comments: 2, saved: 1 } });
    expect(score).toBe(15);
  });

  it('soma alcance de múltiplos canais (reach + impressions)', () => {
    const m = {
      instagram: { likes: 10, reach: 500 },
      linkedin: { likes: 10, impressions: 500 },
    };
    // weighted = 20, reach = 1000 → 20/1000*1000 = 20
    expect(engagementScore(m)).toBe(20);
  });
});
