import { describe, it, expect } from 'vitest';
import { buildFeedbackBlock, buildImageGuidance, getRecentFeedback, _internal } from '../src/utils/feedback.js';
import { filterRules, normalizeDerivedRules, buildReflectPrompt } from '../src/utils/reflections.js';
import { buildImagePrompt } from '../src/utils/image-gen.js';
import { parseFeedbackInput, parseRuleInput, parseRulePatch } from '../platform/src/lib/learning.ts';

const fb = (aspect, note, extra = {}) => ({ aspect, note, sentiment: 'negativo', channel: null, ...extra });

describe('buildFeedbackBlock (prompt de texto)', () => {
  it('vazio sem feedback', () => {
    expect(buildFeedbackBlock([])).toBe('');
  });

  it('agrupa por aspecto e deixa visual de fora', () => {
    const block = buildFeedbackBlock([
      fb('tom', 'soou vendedor', { excerpt: 'Seu escritório perde dinheiro' }),
      fb('visual', 'fundo escuro demais'),
      fb('tom', 'formal demais'),
      fb('cta', 'pergunta forçada'),
    ]);
    expect(block).toContain('## Evite');
    expect(block).toContain('### tom\n- soou vendedor (no post "Seu escritório perde dinheiro")\n- formal demais');
    expect(block).toContain('### cta\n- pergunta forçada');
    expect(block).not.toContain('fundo escuro');
  });

  it('positivo vira "Mantenha", separado do "Evite"', () => {
    const block = buildFeedbackBlock([fb('texto', 'gancho com número concreto', { sentiment: 'positivo' })]);
    expect(block).toContain('## Mantenha');
    expect(block).not.toContain('## Evite');
  });

  it('limita por sentimento', () => {
    const many = Array.from({ length: 20 }, (_, i) => fb('texto', `nota ${i}`));
    const lines = buildFeedbackBlock(many).split('\n').filter(l => l.startsWith('- '));
    expect(lines).toHaveLength(_internal.MAX_PER_SENTIMENT);
  });

  it('sem banco, leitura devolve []', async () => {
    await expect(getRecentFeedback('pilar', { channel: 'instagram' })).resolves.toEqual([]);
  });
});

describe('orientação de imagem', () => {
  it('junta regra de visual e feedback de visual, ignora o resto', () => {
    const g = buildImageGuidance(['sem pessoas na cena'], [
      fb('visual', 'fundo escuro demais'),
      fb('visual', 'paleta verde ficou boa', { sentiment: 'positivo' }),
      fb('texto', 'gancho fraco'),
    ]);
    expect(g).toContain('- sem pessoas na cena');
    expect(g).toContain('- evitar: fundo escuro demais');
    expect(g).toContain('- manter: paleta verde ficou boa');
    expect(g).not.toContain('gancho');
  });

  it('entra no prompt de imagem só quando existe', () => {
    expect(buildImagePrompt('a desk')).not.toContain('Editor guidance');
    expect(buildImagePrompt('a desk', 'Editor guidance: x')).toMatch(/Subject: a desk\n\nEditor guidance: x$/);
  });
});

describe('filterRules', () => {
  const rows = [
    { rule: 'a', channel: null, aspect: null },
    { rule: 'b', channel: 'linkedin', aspect: 'tom' },
    { rule: 'c', channel: null, aspect: 'visual' },
    { rule: 'd', channel: 'instagram', aspect: 'visual' },
  ];

  it('texto por padrão: sem aspecto conta como texto, visual fica de fora', () => {
    expect(filterRules(rows, { channel: 'linkedin' }).map(r => r.rule)).toEqual(['a', 'b']);
  });

  it('visual só quando pedido, respeitando o canal', () => {
    expect(filterRules(rows, { channel: 'linkedin', aspects: ['visual'] }).map(r => r.rule)).toEqual(['c']);
    expect(filterRules(rows, { channel: 'instagram', aspects: ['visual'] }).map(r => r.rule)).toEqual(['c', 'd']);
  });
});

describe('reflect: prompt e validação da saída', () => {
  it('prompt traz edições e feedbacks', () => {
    const p = buildReflectPrompt({
      tenantName: 'Pilar',
      pairs: [{ channel: 'linkedin', suggested: 'A', edited: 'B' }],
      feedback: [fb('visual', 'fundo escuro', { channel: 'instagram' })],
    });
    expect(p).toContain('SUGERIDO: A');
    expect(p).toContain('Feedback 1 (não gostou, visual, instagram): fundo escuro');
  });

  it('corrige aspecto, canal e origem inválidos; aceita formato antigo', () => {
    const out = normalizeDerivedRules({
      rules: [
        { rule: ' Sem emoji no gancho ', aspect: 'tom', channel: 'linkedin', source: 'feedback' },
        { rule: 'Fundo claro', aspect: 'cor', channel: 'tiktok', source: 'chute' },
        'Frase curta',
        { rule: '' },
        null,
      ],
    });
    expect(out).toEqual([
      { rule: 'Sem emoji no gancho', aspect: 'tom', channel: 'linkedin', source: 'feedback' },
      { rule: 'Fundo claro', aspect: 'texto', channel: null, source: 'edicao' },
      { rule: 'Frase curta', aspect: 'texto', channel: null, source: 'edicao' },
    ]);
  });

  it('saída sem rules vira lista vazia', () => {
    expect(normalizeDerivedRules({})).toEqual([]);
    expect(normalizeDerivedRules(null)).toEqual([]);
  });
});

describe('validação na plataforma (learning.ts)', () => {
  it('feedback válido', () => {
    const r = parseFeedbackInput({ aspect: 'visual', note: ' fundo escuro ', channel: 'instagram', post_id: 'nao-uuid' });
    expect(r).toEqual({
      ok: true,
      value: {
        aspect: 'visual',
        sentiment: 'negativo',
        note: 'fundo escuro',
        channel: 'instagram',
        excerpt: null,
        pending_id: null,
        scheduled_post_id: null,
        post_id: null,
      },
    });
  });

  it('feedback sem aspecto, sem nota ou com rede inválida é recusado', () => {
    expect(parseFeedbackInput({ note: 'x' }).ok).toBe(false);
    expect(parseFeedbackInput({ aspect: 'tom', note: '   ' }).ok).toBe(false);
    expect(parseFeedbackInput({ aspect: 'tom', note: 'x', channel: 'tiktok' }).ok).toBe(false);
    expect(parseFeedbackInput(null).ok).toBe(false);
  });

  it('"todas" vira canal null', () => {
    const r = parseFeedbackInput({ aspect: 'tom', note: 'x', channel: 'todas' });
    expect(r.ok && r.value.channel).toBe(null);
  });

  it('regra: exige texto e aspecto', () => {
    expect(parseRuleInput({ rule: 'Sem emoji', aspect: 'tom', channel: 'todas' })).toEqual({
      ok: true,
      value: { rule: 'Sem emoji', aspect: 'tom', channel: null },
    });
    expect(parseRuleInput({ rule: '', aspect: 'tom' }).ok).toBe(false);
    expect(parseRuleInput({ rule: 'x', aspect: 'humor' }).ok).toBe(false);
  });

  it('patch: liga/desliga, reescreve, ou recusa vazio', () => {
    const id = '3f2a9c1e-7b4d-4e2a-9c11-aa00bb11cc22';
    expect(parseRulePatch({ id, active: false })).toEqual({ ok: true, value: { id, active: false } });
    const edit = parseRulePatch({ id, rule: 'Nova', aspect: 'cta', channel: 'twitter' });
    expect(edit.ok && edit.value.input).toEqual({ rule: 'Nova', aspect: 'cta', channel: 'twitter' });
    expect(parseRulePatch({ id }).ok).toBe(false);
    expect(parseRulePatch({ id: 'x', active: true }).ok).toBe(false);
  });
});
