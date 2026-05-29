import { describe, it, expect } from 'vitest';
import { normalizeReelScript } from '../src/reel.js';

describe('normalizeReelScript', () => {
  it('normaliza shape completo e numera cenas', () => {
    const s = normalizeReelScript({
      hook_0_3s: 'Você manda Rev04 quando devia ser Rev06?',
      scenes: [
        { visual: 'tela de planilha', voiceover: 'fala 1', caption: 'leg 1' },
        { visual: 'close no caos', voiceover: 'fala 2', caption: 'leg 2' },
      ],
      cta: 'Comenta REV',
      duration_s: 28,
      visual_style: 'cru, mobile',
    });
    expect(s.scenes).toHaveLength(2);
    expect(s.scenes[0].n).toBe(1);
    expect(s.scenes[1].n).toBe(2);
    expect(s.duration_s).toBe(28);
  });

  it('aceita aliases (hook, broll, vo, legenda)', () => {
    const s = normalizeReelScript({
      hook: 'H', scenes: [{ broll: 'b', vo: 'v', legenda: 'l' }],
    });
    expect(s.hook_0_3s).toBe('H');
    expect(s.scenes[0].visual).toBe('b');
    expect(s.scenes[0].voiceover).toBe('v');
    expect(s.scenes[0].caption).toBe('l');
  });

  it('descarta cenas vazias', () => {
    const s = normalizeReelScript({ hook_0_3s: 'H', scenes: [{ voiceover: 'v' }, {}, { caption: 'c' }] });
    expect(s.scenes).toHaveLength(2);
  });

  it('null quando falta hook ou cenas', () => {
    expect(normalizeReelScript({ scenes: [{ voiceover: 'v' }] })).toBeNull();
    expect(normalizeReelScript({ hook_0_3s: 'H', scenes: [] })).toBeNull();
    expect(normalizeReelScript(null)).toBeNull();
  });
});
