import { describe, it, expect } from 'vitest';
import { parseFunnelResponse, funnelWindow, totalsByContent, buildFunnelReport, isDistributionContent } from '../src/utils/funnel.js';
import { rewardScore, funnelPoints } from '../src/utils/score.js';
import { _internal as bandit } from '../src/utils/bandit.js';
import { dbRowToPublished } from '../src/utils/queue.js';

const linha = (over = {}) => ({
  dia: '2026-11-20', utm_source: 'linkedin', utm_medium: 'organico', utm_campaign: 'quanto-custa-um-projeto',
  utm_content: 'd1122ee5d', cadastros: 3, ativados: 1, pagantes: 0, ...over,
});
const resposta = linhas => ({ gerado_em: '2026-11-21T09:30:00Z', desde: '2026-07-25', ate: '2026-11-21', linhas });

describe('contrato do ops-export-funil', () => {
  it('aceita a resposta da Pilar e troca UTM null por vazio', () => {
    const { rows } = parseFunnelResponse(resposta([linha(), linha({ utm_source: null, utm_content: null })]));
    expect(rows[0]).toMatchObject({ day: '2026-11-20', utm_content: 'd1122ee5d', ativados: 1 });
    expect(rows[1]).toMatchObject({ utm_source: '', utm_content: '' });
  });

  it('rejeita contrato quebrado antes de gravar', () => {
    expect(() => parseFunnelResponse({})).toThrow(/linhas/);
    expect(() => parseFunnelResponse({ linhas: [], desde: 'ontem', ate: '2026-11-21' })).toThrow(/AAAA-MM-DD/);
    expect(() => parseFunnelResponse(resposta([linha({ ativados: -1 })]))).toThrow(/ativados/);
    expect(() => parseFunnelResponse(resposta([linha({ cadastros: '3' })]))).toThrow(/cadastros/);
    expect(() => parseFunnelResponse(resposta([linha({ dia: '20/11/2026' })]))).toThrow(/dia/);
    expect(() => parseFunnelResponse(resposta([linha({ utm_campaign: 5 })]))).toThrow(/utm_campaign/);
  });

  it('janela de 120 dias no dia de Brasília', () => {
    // 02:00 UTC de 16/10 ainda é 15/10 em Brasília
    expect(funnelWindow(new Date('2026-10-16T02:00:00Z'))).toEqual({ desde: '2026-06-18', ate: '2026-10-15' });
    expect(funnelWindow(new Date('2026-10-16T12:00:00Z'), 7)).toEqual({ desde: '2026-10-10', ate: '2026-10-16' });
  });
});

describe('ligação com o post', () => {
  it('soma por distribuição e ignora bio e UTM manual', () => {
    const { rows } = parseFunnelResponse(resposta([
      linha(), linha({ dia: '2026-11-21', cadastros: 2, ativados: 2 }),
      linha({ utm_source: 'instagram', utm_medium: 'bio', utm_content: 'bio' }),
      linha({ utm_content: 'post-do-matheus' }),
    ]));
    const totals = totalsByContent(rows);
    expect([...totals.keys()]).toEqual(['d1122ee5d']);
    expect(totals.get('d1122ee5d')).toEqual({ cadastros: 5, ativados: 3, pagantes: 0 });
    expect(isDistributionContent('dZZZZZZZZ')).toBe(false);
  });

  it('o post lido do banco carrega o funil', () => {
    const p = dbRowToPublished({ id: 'x', pillar: 'dor', engagement_score: '12', funnel: { cadastros: 1, ativados: 1, pagantes: 0 } });
    expect(p.funnel.ativados).toBe(1);
    expect(p.engagement_score).toBe(12);
  });
});

describe('recompensa do bandit', () => {
  it('ativado pesa mais que curtida', () => {
    expect(funnelPoints({ cadastros: 1, ativados: 1, pagantes: 1 })).toBe(260);
    expect(rewardScore({ engagement_score: 20 })).toBe(20);
    expect(rewardScore({ funnel: { cadastros: 2, ativados: 1, pagantes: 0 } })).toBe(70);
    expect(rewardScore({ engagement_score: 20, funnel: { cadastros: 0, ativados: 1, pagantes: 0 } })).toBe(70);
    expect(rewardScore({})).toBeNull();
  });

  it('com o mesmo engajamento, o pilar que trouxe ativado ganha', () => {
    const now = Date.parse('2026-11-25T12:00:00Z');
    const at = '2026-11-20T12:00:00Z';
    const posts = [
      { pillar: 'dor', engagement_score: 30, published_at: at },
      { pillar: 'dica', engagement_score: 30, published_at: at, funnel: { cadastros: 2, ativados: 1, pagantes: 0 } },
    ];
    const post = bandit.computePosteriors(['dor', 'dica'], posts, { now, priorStrength: 0 });
    expect(post.dica.alpha).toBeGreaterThan(post.dor.alpha);
  });
});

describe('relatório semanal', () => {
  it('fica vazio sem cadastro', () => {
    expect(buildFunnelReport({ rows: [] })).toBe('');
    const { rows } = parseFunnelResponse(resposta([linha({ cadastros: 0, ativados: 0 })]));
    expect(buildFunnelReport({ rows })).toBe('');
  });

  it('mostra total, canal, campanha e posts que mais ativaram', () => {
    const { rows } = parseFunnelResponse(resposta([linha(), linha({ utm_source: 'twitter', cadastros: 1, ativados: 0 })]));
    const out = buildFunnelReport({ rows, topPosts: [{ channel: 'linkedin', hook: 'Revisão 3 de graça', funnel: { cadastros: 3, ativados: 1, pagantes: 0 } }] });
    expect(out).toContain('Total: cadastros 4 · ativados 1 · pagantes 0');
    expect(out).toContain('• linkedin: cadastros 3');
    expect(out).toContain('quanto-custa-um-projeto');
    expect(out).toContain('• linkedin: Revisão 3 de graça (ativados 1 · cadastros 3)');
  });
});
