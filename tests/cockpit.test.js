import { describe, it, expect } from 'vitest';
import { _internal } from '../src/telegram.js';

const { parseCallback, buildKeyboard, buildArtKeyboard } = _internal;

describe('parseCallback — cockpit desacoplado', () => {
  it('c: → escolha de legenda', () => {
    expect(parseCallback('c:instagram-abc:2')).toEqual({ action: 'caption', pendingId: 'instagram-abc', chosenCaptionId: 2 });
  });
  it('g: → escolha de arte', () => {
    expect(parseCallback('g:instagram-abc:3')).toEqual({ action: 'art', pendingId: 'instagram-abc', chosenArtId: 3 });
  });
  it('a: → compat (1 clique)', () => {
    expect(parseCallback('a:instagram-abc:1')).toEqual({ action: 'approve', pendingId: 'instagram-abc', chosenId: 1 });
  });
  it('r:/x: → regen/reject', () => {
    expect(parseCallback('r:pid').action).toBe('regen');
    expect(parseCallback('x:pid').action).toBe('reject');
  });
  it('inválido → null', () => {
    expect(parseCallback('z:pid')).toBeNull();
    expect(parseCallback('')).toBeNull();
  });
});

describe('teclados', () => {
  const vars = [{ id: 1 }, { id: 2 }, { id: 3 }];
  it('passo 1 (legenda) usa callback c:', () => {
    const kb = buildKeyboard('pid', vars);
    expect(kb.inline_keyboard[0].map(b => b.callback_data)).toEqual(['c:pid:1', 'c:pid:2', 'c:pid:3']);
    expect(kb.inline_keyboard[1].map(b => b.callback_data)).toEqual(['r:pid', 'x:pid']);
  });
  it('passo 2 (arte) usa callback g:', () => {
    const kb = buildArtKeyboard('pid', [{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(kb.inline_keyboard[0].map(b => b.callback_data)).toEqual(['g:pid:1', 'g:pid:2', 'g:pid:3']);
  });
});
