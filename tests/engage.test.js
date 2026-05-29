import { describe, it, expect } from 'vitest';
import { normalizeComments } from '../src/engage.js';

describe('normalizeComments', () => {
  it('extrai de {comments:[...]}', () => {
    expect(normalizeComments({ comments: ['a', 'b', 'c'] })).toEqual(['a', 'b', 'c']);
  });
  it('aceita array direto e objetos {text}', () => {
    expect(normalizeComments(['x'])).toEqual(['x']);
    expect(normalizeComments({ comments: [{ text: 'y' }] })).toEqual(['y']);
  });
  it('limpa vazios e respeita n', () => {
    expect(normalizeComments({ comments: ['a', '', '  ', 'b', 'c', 'd'] }, 3)).toEqual(['a', 'b', 'c']);
  });
  it('entrada inválida → []', () => {
    expect(normalizeComments(null)).toEqual([]);
    expect(normalizeComments({})).toEqual([]);
  });
});
