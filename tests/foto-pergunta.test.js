import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { croquisManifest, croquisPromptList, pickSketch } from '../src/utils/croquis.js';
import { checkGuardrails, _internal as gen } from '../src/generate.js';
import { _internal as render, brandCss } from '../src/render-image.js';
import { chooseNextFormat } from '../src/utils/ranking.js';
import { resolveTenant } from '../src/tenant.js';

describe('biblioteca de croquis', () => {
  const list = croquisManifest();

  it('tem pelo menos 20 peças, ids únicos e arquivo para cada uma', () => {
    expect(list.length).toBeGreaterThanOrEqual(20);
    expect(new Set(list.map(c => c.id)).size).toBe(list.length);
    for (const c of list) expect(existsSync(`assets/croquis/${c.id}.svg`)).toBe(true);
  });

  it('cada SVG é seguro e tem um elemento de destaque', () => {
    for (const c of list) {
      const svg = readFileSync(`assets/croquis/${c.id}.svg`, 'utf8');
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/<script|on\w+=|javascript:|<foreignObject|xlink:href|href=/i);
      expect(svg).toMatch(/class="accent(-stroke)?"/);
    }
  });

  it('pickSketch usa o id do modelo e cai pelas tags quando o id não existe', () => {
    expect(pickSketch({ id: 'relogio' }).id).toBe('relogio');
    expect(pickSketch({ id: '<svg onload=x>', angle: 'cobranca' }).tags).toContain('cobranca');
    expect(pickSketch({ id: 'nada', pillar: 'pilar-inexistente' }).id).toBe('prancha');
  });

  it('a lista do prompt traz id e rótulo', () => {
    expect(croquisPromptList()).toContain('nuvem-revisao (Nuvem de revisão)');
  });
});

describe('guardrail da foto-pergunta', () => {
  const base = { hook: 'h', body: 'b', format: 'pergunta' };

  it('aceita pergunta curta com interrogação', () => {
    expect(checkGuardrails({ ...base, question: 'Você cobra a revisão 3 ou faz de graça?' }, { pillar: 'dor' }).clean).toBe(true);
  });

  it('sinaliza pergunta longa, sem ? ou ausente', () => {
    const longa = 'Quanto do seu tempo de sócio vai para refazer prancha que o cliente mudou de ideia?';
    expect(checkGuardrails({ ...base, question: longa }, { pillar: 'dor' }).flags).toContain('pergunta-longa:max-12-palavras');
    expect(checkGuardrails({ ...base, question: 'Você cobra a revisão' }, { pillar: 'dor' }).flags).toContain('pergunta-sem-interrogacao');
    expect(checkGuardrails(base, { pillar: 'dor' }).flags).toContain('pergunta-ausente');
  });

  it('mock do Instagram/dor traz uma variação pergunta válida', () => {
    const v = gen.mockGeneration({ channel: 'instagram', pillar: 'dor' }).variations.find(x => x.format === 'pergunta');
    expect(v.question.endsWith('?')).toBe(true);
    expect(pickSketch({ id: v.sketch }).id).toBe(v.sketch);
  });
});

describe('render: slot sem escape, marca e slides', () => {
  it('applyRaw troca só {{{chave}}} e apaga slot sem valor', () => {
    const out = render.applyRaw('<i>{{{sketch}}}</i>{{{sobrou}}}{{hook}}', { sketch: '<svg/>' });
    expect(out).toBe('<i><svg/></i>{{hook}}');
  });

  it('applyVars ainda escapa o texto do modelo', () => {
    expect(render.applyVars('{{question}}', { question: '<b>x</b>' })).toContain('&lt;b&gt;');
  });

  it('brandCss usa as cores do tenant', () => {
    const css = brandCss(resolveTenant().brand.colors);
    expect(css).toContain('--accent:#A4EC86');
    expect(css).toContain('--ink:#1A1A1A');
  });

  it('slideVars: capa, itens numerados e fechamento', () => {
    const kinds = [0, 1, 2, 3, 4].map(i => render.slideVars('x', i, 5).kind);
    expect(kinds).toEqual(['capa', 'item', 'item', 'item', 'fim']);
    expect(render.slideVars('x', 2, 5).number).toBe('2');
    expect(render.slideVars('x', 1, 2).kind).toBe('item');
  });
});

describe('formato pergunta no bandit', () => {
  it('3 carrosséis seguidos puxam o formato menos usado', () => {
    const hist = ['single', 'carousel', 'carousel', 'carousel'].map(format => ({ format }));
    expect(chooseNextFormat(hist)).toBe('pergunta');
  });

  it('o Instagram da Pilar aceita o formato', () => {
    expect(resolveTenant().platforms.instagram.formats).toContain('pergunta');
  });
});
