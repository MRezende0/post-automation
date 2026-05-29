import { describe, it, expect } from 'vitest';
import { sampleBeta, computePosteriors, thompsonChoose } from '../src/utils/bandit.js';

const ARMS = ['dor', 'dica', 'building', 'prova'];

describe('sampleBeta', () => {
  it('sempre devolve valor em [0,1]', () => {
    for (let i = 0; i < 500; i++) {
      const x = sampleBeta(2, 5);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });

  it('média empírica ≈ α/(α+β)', () => {
    const n = 5000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sampleBeta(8, 2);
    expect(sum / n).toBeCloseTo(0.8, 1); // 8/10
  });
});

describe('computePosteriors', () => {
  const now = new Date('2026-05-29T00:00:00Z').getTime();

  it('arm com scores altos acumula recompensa maior que arm com scores baixos', () => {
    const posts = [
      { pillar: 'dica', engagement_score: 100, published_at: '2026-05-28T00:00:00Z' },
      { pillar: 'dica', engagement_score: 90, published_at: '2026-05-27T00:00:00Z' },
      { pillar: 'dor', engagement_score: 10, published_at: '2026-05-28T00:00:00Z' },
      { pillar: 'dor', engagement_score: 5, published_at: '2026-05-27T00:00:00Z' },
    ];
    const post = computePosteriors(ARMS, posts, { keyField: 'pillar', now });
    const meanDica = post.dica.alpha / (post.dica.alpha + post.dica.beta);
    const meanDor = post.dor.alpha / (post.dor.alpha + post.dor.beta);
    expect(meanDica).toBeGreaterThan(meanDor);
  });

  it('decaimento: post recente pesa mais que post velho de mesmo score', () => {
    const recente = computePosteriors(['dor'], [
      { pillar: 'dor', engagement_score: 100, published_at: '2026-05-28T00:00:00Z' },
    ], { keyField: 'pillar', now, halfLifeDays: 30 });
    const velho = computePosteriors(['dor'], [
      { pillar: 'dor', engagement_score: 100, published_at: '2026-01-01T00:00:00Z' },
    ], { keyField: 'pillar', now, halfLifeDays: 30 });
    // span=0 (1 post) → reward 0.5; mas o peso (decay) do recente é maior → α maior
    expect(recente.dor.alpha).toBeGreaterThan(velho.dor.alpha);
  });

  it('ignora posts sem engagement_score numérico', () => {
    const post = computePosteriors(ARMS, [
      { pillar: 'dor', published_at: '2026-05-28T00:00:00Z' },
      { pillar: 'dica', engagement_score: null, published_at: '2026-05-28T00:00:00Z' },
    ], { keyField: 'pillar', now });
    expect(Object.values(post).reduce((a, p) => a + p.n, 0)).toBe(0);
  });
});

describe('thompsonChoose', () => {
  it('cold start: < minScored posts pontuados → null', () => {
    const posts = [{ pillar: 'dor', engagement_score: 100, published_at: '2026-05-28T00:00:00Z' }];
    expect(thompsonChoose(ARMS, posts, { keyField: 'pillar', minScored: 4 })).toBeNull();
  });

  it('com sinal forte, favorece o arm dominante na maioria das amostras', () => {
    const now = new Date('2026-05-29T00:00:00Z').getTime();
    const posts = [];
    for (let i = 0; i < 8; i++) {
      posts.push({ pillar: 'dica', engagement_score: 100, published_at: '2026-05-28T00:00:00Z' });
      posts.push({ pillar: 'dor', engagement_score: 2, published_at: '2026-05-28T00:00:00Z' });
    }
    let dica = 0;
    for (let i = 0; i < 200; i++) {
      if (thompsonChoose(ARMS, posts, { keyField: 'pillar', priorStrength: 2, now }) === 'dica') dica += 1;
    }
    expect(dica).toBeGreaterThan(120); // maioria clara, mas ainda explora outros
  });
});
