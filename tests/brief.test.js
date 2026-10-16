import { describe, it, expect } from 'vitest';
import { pickMotherChannel, motherFormat, derivedFormat, buildReusePlan, mondayOf } from '../src/utils/brief.js';
import { buildAdaptPrompt, adaptPost, startUsage, takeUsage, sumUsage } from '../src/generate.js';
import { resolveTenant } from '../src/tenant.js';

const tenant = resolveTenant('pilar');
const ALL = ['instagram', 'linkedin', 'twitter'];

describe('pickMotherChannel', () => {
  it('item da fila manda, depois campanha, depois pilar, depois o 1º canal', () => {
    expect(pickMotherChannel({ channels: ALL, pillar: 'dica', tenant, preferred: ['linkedin'] })).toBe('linkedin');
    expect(pickMotherChannel({ channels: ALL, pillar: 'dica', tenant, campaign: { formats_mix: { linkedin: ['text'] } } })).toBe('linkedin');
    expect(pickMotherChannel({ channels: ALL, pillar: 'building', tenant })).toBe('linkedin');
    expect(pickMotherChannel({ channels: ALL, pillar: 'dica', tenant })).toBe('instagram');
    expect(pickMotherChannel({ channels: ['instagram'], pillar: 'building', tenant })).toBe('instagram');
  });
});

describe('motherFormat / derivedFormat', () => {
  it('classifica o conteúdo-mãe', () => {
    expect(motherFormat({ format: 'carousel', body: 'x' })).toBe('carousel');
    expect(motherFormat({ format: 'pergunta', body: 'x' })).toBe('pergunta');
    expect(motherFormat({ format: 'single', body: 'x'.repeat(701) })).toBe('texto_longo');
    expect(motherFormat({ format: 'single', body: 'curto' })).toBe('texto_curto');
  });

  it('formato que cada rede publica ao reaproveitar', () => {
    expect(derivedFormat('twitter', 'texto_longo')).toBe('thread');
    expect(derivedFormat('twitter', 'pergunta')).toBe('single');
    expect(derivedFormat('linkedin', 'carousel')).toBe('carousel');
    expect(derivedFormat('linkedin', 'texto_curto')).toBe('text');
    expect(derivedFormat('instagram', 'pergunta')).toBe('pergunta');
  });
});

describe('buildReusePlan', () => {
  it('texto longo do LinkedIn: IG ganha post próprio, X travado sem credencial', () => {
    const plan = buildReusePlan({ channels: ALL, mother: 'linkedin', kind: 'texto_longo', tenant });
    expect(plan.linkedin).toEqual({ mode: 'mother' });
    expect(plan.instagram).toEqual({ mode: 'own' });
    expect(plan.twitter.mode).toBe('locked');
    expect(plan.twitter.reason).toMatch(/twitter/);
  });

  it('carrossel do IG: LinkedIn reaproveita como carrossel', () => {
    const plan = buildReusePlan({ channels: ['instagram', 'linkedin'], mother: 'instagram', kind: 'carousel', tenant });
    expect(plan.linkedin).toEqual({ mode: 'reuse', format: 'carousel' });
  });

  it('foto-pergunta pula o LinkedIn', () => {
    const plan = buildReusePlan({ channels: ['instagram', 'linkedin'], mother: 'instagram', kind: 'pergunta', tenant });
    expect(plan.linkedin).toEqual({ mode: 'skip' });
  });

  it('com o X liberado, formato fora da matriz trava com motivo', () => {
    const open = { ...tenant, platforms: { ...tenant.platforms, twitter: { ...tenant.platforms.twitter, publish: true } } };
    const isPublishable = (channel, format) => !(channel === 'twitter' && format === 'thread');
    const plan = buildReusePlan({ channels: ALL, mother: 'linkedin', kind: 'texto_longo', tenant: open, isPublishable });
    expect(plan.twitter).toEqual({ mode: 'locked', reason: 'twitter não publica thread por API' });
  });

  it('modo desconhecido na tabela cai em post próprio', () => {
    const odd = { ...tenant, reuse: { byFormat: { texto_curto: { linkedin: 'talvez' } } } };
    const plan = buildReusePlan({ channels: ['instagram', 'linkedin'], mother: 'instagram', kind: 'texto_curto', tenant: odd });
    expect(plan.linkedin).toEqual({ mode: 'own' });
  });
});

describe('adaptação', () => {
  const variation = { id: 2, hook: 'Rev04 no lugar da Rev06', body: 'Cliente achou em campo.', slides: ['a', 'b'], slideUrls: ['u1', 'u2'], format: 'carousel' };

  it('prompt pede thread no X e proíbe inventar', () => {
    const p = buildAdaptPrompt({ fromChannel: 'linkedin', toChannel: 'twitter', pillar: 'dor', variation, kind: 'texto_longo', tenant, rules: ['sem emoji'] });
    expect(p).toContain('Não invente fato');
    expect(p).toContain('linha em branco');
    expect(p).toContain('- sem emoji');
    expect(p).toContain('Hook original: Rev04 no lugar da Rev06');
  });

  it('carrossel mantém os mesmos slides (dry-run)', async () => {
    const g = await adaptPost({ fromChannel: 'instagram', toChannel: 'linkedin', pillar: 'dica', variation, kind: 'carousel', dryRun: true, tenant });
    expect(g.variations[0]).toMatchObject({ id: 2, format: 'carousel', slides: ['a', 'b'], slideUrls: ['u1', 'u2'] });
  });
});

describe('contagem de tokens', () => {
  it('sem chamadas, zera; soma por ideia', () => {
    startUsage();
    expect(takeUsage()).toEqual({ calls: 0, input: 0, output: 0, total: 0 });
    expect(sumUsage([{ calls: 5, input: 100, output: 50, total: 150 }, null, { calls: 1, input: 10, output: 5, total: 15 }]))
      .toEqual({ calls: 6, input: 110, output: 55, total: 165 });
  });
});

describe('mondayOf', () => {
  it('semana começa na segunda', () => {
    expect(mondayOf(new Date('2026-10-15T12:00:00Z'))).toBe('2026-10-12');
    expect(mondayOf(new Date('2026-10-18T12:00:00Z'))).toBe('2026-10-12');
    expect(mondayOf(new Date('2026-10-19T00:00:00Z'))).toBe('2026-10-19');
  });
});
