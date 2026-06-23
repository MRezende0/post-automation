import { describe, it, expect } from 'vitest';
import { resolveTenant, listTenants } from '../src/tenant.js';
import { chooseNextPillar, chooseNextAngle, chooseNextFormat } from '../src/utils/ranking.js';

describe('tenant.js', () => {
  it('resolve a Pilar como tenant default', () => {
    const t = resolveTenant();
    expect(t.id).toBe('pilar');
    expect(t.taxonomy.pillarWeights).toHaveProperty('dor');
    expect(t.guardrails.foraIcp).toContain('canteiro');
  });

  it('lança em tenant desconhecido', () => {
    expect(() => resolveTenant('inexistente')).toThrow(/desconhecido/i);
  });

  it('lista os tenants conhecidos', () => {
    expect(listTenants()).toContain('pilar');
  });
});

// Prova de que o motor de seleção é tenant-aware: um tenant fictício com
// taxonomia própria escolhe pelos SEUS pilares/ângulos/formatos, não pelos da Pilar.
describe('ranking tenant-aware', () => {
  const outro = {
    pillarWeights: { educacao: 0.6, bastidores: 0.4 },
    angles: { educacao: ['passo_a_passo', 'mito_verdade'], bastidores: ['rotina', 'erro'] },
    formats: ['reel', 'carousel'],
  };

  it('escolhe o pilar de maior peso do tenant no histórico vazio', () => {
    expect(chooseNextPillar([], 20, outro)).toBe('educacao');
  });

  it('escolhe ângulo dentro da taxonomia do tenant', () => {
    const angle = chooseNextAngle('educacao', [], 30, outro);
    expect(outro.angles.educacao).toContain(angle);
  });

  it('varia pro formato secundário do tenant após 3 do primário', () => {
    const hist = [
      { post: { format: 'reel' } },
      { post: { format: 'reel' } },
      { post: { format: 'reel' } },
    ];
    expect(chooseNextFormat(hist, {}, outro)).toBe('carousel');
  });

  it('ignora pilar fora da taxonomia do tenant', () => {
    expect(chooseNextAngle('dor', [], 30, outro)).toBeNull();
  });
});
