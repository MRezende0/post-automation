import { describe, it, expect } from 'vitest';
import { targetChannelFor, pickRepurposeCandidate, repurposeBrief } from '../src/repurpose.js';

describe('targetChannelFor', () => {
  it('alterna canal', () => {
    expect(targetChannelFor('linkedin')).toBe('instagram');
    expect(targetChannelFor('instagram')).toBe('linkedin');
  });
});

describe('pickRepurposeCandidate', () => {
  const real = (body, score, ch = 'instagram') => ({
    pillar: 'dor', angle: 'x', post: { body, hook: 'h' },
    engagement_score: score, channels: { [ch]: { id: '1', channel: ch } },
  });

  it('escolhe o de maior engajamento', () => {
    const c = pickRepurposeCandidate([real('a', 10), real('b', 99), real('c', 50)]);
    expect(c.engagement_score).toBe(99);
  });

  it('ignora dry-run, sem corpo e sem score', () => {
    const dry = { pillar: 'dor', post: { body: 'x' }, engagement_score: 1000, channels: { instagram: { dryRun: true } } };
    const noBody = { pillar: 'dor', post: {}, engagement_score: 1000, channels: { instagram: { id: '1' } } };
    const noScore = { pillar: 'dor', post: { body: 'x' }, channels: { instagram: { id: '1' } } };
    expect(pickRepurposeCandidate([dry, noBody, noScore])).toBeNull();
  });

  it('respeita minScore', () => {
    expect(pickRepurposeCandidate([real('a', 5)], { minScore: 10 })).toBeNull();
  });
});

describe('repurposeBrief', () => {
  it('aponta pro canal alvo e injeta o corpo original como contexto', () => {
    const cand = { pillar: 'dica', angle: 'precificacao', engagement_score: 80,
      post: { body: 'CONTEUDO ORIGINAL', hook: 'h' }, channels: { instagram: { id: '1', channel: 'instagram' } } };
    const brief = repurposeBrief(cand);
    expect(brief.channels).toEqual(['linkedin']);
    expect(brief.pillar).toBe('dica');
    expect(brief.context).toContain('CONTEUDO ORIGINAL');
    expect(brief.context).toContain('REPURPOSE');
  });
});
