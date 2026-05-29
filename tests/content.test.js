import { describe, it, expect } from 'vitest';
import { composeCaption } from '../src/generate.js';
import { pickScenes, SCENES_BY_PILLAR } from '../src/utils/image-gen.js';

describe('composeCaption', () => {
  it('junta corpo + hashtags (2 linhas de separação)', () => {
    const c = composeCaption({ body: 'corpo do post', hashtags: ['#a', '#b'] });
    expect(c).toBe('corpo do post\n\n#a #b');
  });

  it('prefixa # quando ausente', () => {
    expect(composeCaption({ body: 'x', hashtags: ['eng', '#projeto'] })).toBe('x\n\n#eng #projeto');
  });

  it('sem hashtags → só o corpo', () => {
    expect(composeCaption({ body: 'só corpo' })).toBe('só corpo');
    expect(composeCaption({ body: 'só corpo', hashtags: [] })).toBe('só corpo');
  });

  it('ignora hashtags vazias/espaços', () => {
    expect(composeCaption({ body: 'x', hashtags: ['#a', '', '  '] })).toBe('x\n\n#a');
  });
});

describe('pickScenes', () => {
  it('devolve n cenas distintas quando o pool tem o suficiente', () => {
    const s = pickScenes('dor', 3);
    expect(s).toHaveLength(3);
    expect(new Set(s).size).toBe(3); // todas diferentes
  });

  it('cicla quando n > pool', () => {
    const pool = SCENES_BY_PILLAR.default.length;
    const s = pickScenes('default', pool + 2);
    expect(s).toHaveLength(pool + 2);
    expect(s[0]).toBe(s[pool]); // ciclou
  });

  it('pilar desconhecido cai no default', () => {
    expect(pickScenes('inexistente', 2)).toEqual(SCENES_BY_PILLAR.default.slice(0, 2));
  });
});
