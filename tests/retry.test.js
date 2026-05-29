import { describe, it, expect } from 'vitest';
import { isTransient, withRetry } from '../src/utils/retry.js';

describe('isTransient', () => {
  it('reconhece status transitórios (429/5xx)', () => {
    expect(isTransient({ status: 429 })).toBe(true);
    expect(isTransient({ status: 503 })).toBe(true);
    expect(isTransient(new Error('IG API 500: boom'))).toBe(true);
  });
  it('erros de rede são transitórios', () => {
    expect(isTransient(new Error('fetch failed'))).toBe(true);
    expect(isTransient(new Error('ETIMEDOUT'))).toBe(true);
  });
  it('4xx de cliente (não 429) não é transitório', () => {
    expect(isTransient({ status: 400 })).toBe(false);
    expect(isTransient(new Error('IG API 400: bad request'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('re-tenta em falha transitória e eventualmente sucede', async () => {
    let n = 0;
    const out = await withRetry(async () => {
      n += 1;
      if (n < 3) throw new Error('503 service unavailable');
      return 'ok';
    }, { tries: 3, baseMs: 1 });
    expect(out).toBe('ok');
    expect(n).toBe(3);
  });

  it('não re-tenta erro não-transitório (falha na hora)', async () => {
    let n = 0;
    await expect(withRetry(async () => {
      n += 1;
      const e = new Error('IG API 400: bad');
      e.status = 400;
      throw e;
    }, { tries: 3, baseMs: 1 })).rejects.toThrow('400');
    expect(n).toBe(1);
  });

  it('propaga o erro após esgotar as tentativas', async () => {
    let n = 0;
    await expect(withRetry(async () => {
      n += 1;
      throw new Error('429 too many requests');
    }, { tries: 3, baseMs: 1 })).rejects.toThrow('429');
    expect(n).toBe(3);
  });
});
