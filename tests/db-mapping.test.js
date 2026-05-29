import { describe, it, expect } from 'vitest';
import { dbRowToPublished } from '../src/utils/queue.js';

describe('dbRowToPublished', () => {
  it('converte engagement_score string→number (numeric do Postgres)', () => {
    const item = dbRowToPublished({ pillar: 'dica', engagement_score: '42.5' });
    expect(item.engagement_score).toBe(42.5);
    expect(typeof item.engagement_score).toBe('number'); // senão o bandit ignora
  });

  it('engagement_score nulo → undefined (não vira 0, que enganaria o bandit)', () => {
    const item = dbRowToPublished({ pillar: 'dor', engagement_score: null });
    expect(item.engagement_score).toBeUndefined();
  });

  it('reagrupa hook/body/format em post{} (formato dos consumidores)', () => {
    const item = dbRowToPublished({ pillar: 'dor', hook: 'H', body: 'B', format: 'carousel' });
    expect(item.post).toEqual({ hook: 'H', body: 'B', format: 'carousel' });
  });

  it('preserva channels e campos de aprendizado', () => {
    const row = {
      pillar: 'prova', angle: 'case_curto',
      channels: { instagram: { id: '123', channel: 'instagram' } },
      chosen_variation: 2, published_at: '2026-05-28T00:00:00Z',
    };
    const item = dbRowToPublished(row);
    expect(item.angle).toBe('case_curto');
    expect(item.channels.instagram.id).toBe('123');
    expect(item.chosen_variation).toBe(2);
    expect(item.published_at).toBe('2026-05-28T00:00:00Z');
  });
});
