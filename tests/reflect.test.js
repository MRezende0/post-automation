import { describe, it, expect } from 'vitest';
import { hasMeaningfulEdit, buildReflectionBlock, _internal } from '../src/utils/reflections.js';

describe('hasMeaningfulEdit', () => {
  it('idêntico → false', () => {
    expect(hasMeaningfulEdit('Mesmo texto.', 'Mesmo texto.')).toBe(false);
  });

  it('só diferença de espaço/maiúscula → false', () => {
    expect(hasMeaningfulEdit('Texto  do   post', 'texto do post')).toBe(false);
  });

  it('vazio em qualquer lado → false', () => {
    expect(hasMeaningfulEdit('', 'algo')).toBe(false);
    expect(hasMeaningfulEdit('algo', '')).toBe(false);
  });

  it('reescrita real → true', () => {
    const original = 'Você já mandou Rev04 quando devia ser Rev06? Acontece direto.';
    const edited = 'Rev04 publicada no lugar da Rev06. O cliente achou em campo. Quem mandou?';
    expect(hasMeaningfulEdit(original, edited)).toBe(true);
  });

  it('acréscimo de frase (muda comprimento) → true', () => {
    const original = 'Proposta no feeling.';
    const edited = 'Proposta no feeling. Financeiro descolado da operação. Sempre.';
    expect(hasMeaningfulEdit(original, edited)).toBe(true);
  });
});

describe('buildReflectionBlock', () => {
  it('sem regras → string vazia', () => {
    expect(buildReflectionBlock([])).toBe('');
    expect(buildReflectionBlock(null)).toBe('');
  });

  it('aceita lista de strings e de objetos {rule}', () => {
    const block = buildReflectionBlock(['Use frases mais curtas.', { rule: 'Evite "otimizar".' }]);
    expect(block).toContain('Regras aprendidas');
    expect(block).toContain('- Use frases mais curtas.');
    expect(block).toContain('- Evite "otimizar".');
  });
});

describe('normalize/levenshtein (internos)', () => {
  it('normalize colapsa espaços e baixa caixa', () => {
    expect(_internal.normalize('  A  B\nC ')).toBe('a b c');
  });
  it('levenshtein mede distância de edição', () => {
    expect(_internal.levenshtein('kitten', 'sitting')).toBe(3);
    expect(_internal.levenshtein('abc', 'abc')).toBe(0);
  });
});
