import { describe, it, expect } from 'vitest';
import { _internal } from '../src/telegram.js';

const { escapeHtml, chunkText, buildKeyboard, parseCallback, formatVariationBody } = _internal;

describe('escapeHtml', () => {
  it('escapa caracteres que quebram o parser HTML', () => {
    expect(escapeHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
  });
  it('não toca hashtag com underscore (não vira itálico)', () => {
    expect(escapeHtml('#gestao_de_engenharia')).toBe('#gestao_de_engenharia');
  });
});

describe('chunkText', () => {
  it('mantém texto curto em um único pedaço', () => {
    expect(chunkText('linha curta', 100)).toEqual(['linha curta']);
  });
  it('quebra respeitando linhas, sem exceder o limite', () => {
    const text = Array.from({ length: 10 }, (_, i) => `linha ${i}`).join('\n');
    const out = chunkText(text, 20);
    for (const c of out) expect(c.length).toBeLessThanOrEqual(20);
    expect(out.join('\n')).toBe(text);
  });
  it('nunca corta no meio de uma palavra', () => {
    const text = 'precificacao orcamento engenharia projeto margem lucro';
    const out = chunkText(text, 15);
    for (const c of out) {
      for (const word of c.split(' ')) {
        expect(text.split(' ')).toContain(word);
      }
    }
  });
});

describe('parseCallback', () => {
  it('parseia aprovar com pendingId e variação', () => {
    expect(parseCallback('a:instagram-lq3k2p:2')).toEqual({
      action: 'approve',
      pendingId: 'instagram-lq3k2p',
      chosenId: 2,
    });
  });
  it('parseia regenerar e rejeitar', () => {
    expect(parseCallback('r:linkedin-abc')).toEqual({ action: 'regen', pendingId: 'linkedin-abc' });
    expect(parseCallback('x:linkedin-abc')).toEqual({ action: 'reject', pendingId: 'linkedin-abc' });
  });
  it('retorna null pra dado inválido', () => {
    expect(parseCallback('')).toBeNull();
    expect(parseCallback('zzz:foo')).toBeNull();
  });
});

describe('buildKeyboard', () => {
  it('embute o pendingId em todo callback_data', () => {
    const variations = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const kb = buildKeyboard('instagram-xyz', variations);
    const approve = kb.inline_keyboard[0];
    expect(approve.map(b => b.callback_data)).toEqual([
      'a:instagram-xyz:1',
      'a:instagram-xyz:2',
      'a:instagram-xyz:3',
    ]);
    const actions = kb.inline_keyboard[1].map(b => b.callback_data);
    expect(actions).toEqual(['r:instagram-xyz', 'x:instagram-xyz']);
  });
});

describe('formatVariationBody', () => {
  it('coloca o hook em negrito e escapa o corpo', () => {
    const out = formatVariationBody({ hook: 'Hook', body: 'a < b' });
    expect(out).toBe('<b>Hook</b>\n\na &lt; b');
  });
});
