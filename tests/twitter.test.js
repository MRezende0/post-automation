import { describe, it, expect } from 'vitest';
import { splitThread, publishText, publishThread, _internal } from '../src/channels/twitter.js';

const LIMIT = _internal.TWEET_LIMIT;

describe('splitThread', () => {
  it('texto curto vira 1 tweet', () => {
    expect(splitThread('Post curto e direto.')).toEqual(['Post curto e direto.']);
  });

  it('texto vazio vira lista vazia', () => {
    expect(splitThread('')).toEqual([]);
    expect(splitThread('   ')).toEqual([]);
  });

  it('texto longo quebra em vários tweets, todos dentro do limite', () => {
    const long = Array.from({ length: 12 }, (_, i) =>
      `Parágrafo ${i}: dor concreta de escritório de engenharia de projeto, sem floreio.`,
    ).join('\n\n');
    const tweets = splitThread(long);
    expect(tweets.length).toBeGreaterThan(1);
    for (const t of tweets) expect(t.length).toBeLessThanOrEqual(LIMIT);
  });

  it('parágrafo único gigante é fatiado ao limite', () => {
    const tweets = splitThread('palavra '.repeat(80).trim());
    for (const t of tweets) expect(t.length).toBeLessThanOrEqual(LIMIT);
  });
});

describe('publish (dry-run e guarda de API)', () => {
  it('publishText dry-run retorna mock', async () => {
    const r = await publishText({ text: 'oi', dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.channel).toBe('twitter');
  });

  it('publishThread dry-run retorna a contagem de tweets', async () => {
    const r = await publishThread({ tweets: ['a', 'b', 'c'], dryRun: true });
    expect(r.tweets).toBe(3);
  });

  it('publishText sem dry-run lança (API/app review pendente)', async () => {
    await expect(publishText({ text: 'oi' })).rejects.toThrow(/não habilitada/i);
  });
});
