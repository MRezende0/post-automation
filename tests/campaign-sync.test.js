import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { readFileSync } from 'node:fs';
import { slugify, campaignSlug, campaignToRow } from '../src/utils/campaign-sync.js';

describe('campaign-sync.js', () => {
  it('slugify tira acento e vira kebab-case', () => {
    expect(slugify('Quanto custa um projeto')).toBe('quanto-custa-um-projeto');
    expect(slugify('Pré-lançamento')).toBe('pre-lancamento');
    expect(slugify('  Planeje 2027! ')).toBe('planeje-2027');
  });

  it('slug explícito vence o nome', () => {
    expect(campaignSlug({ name: 'Lançamento', slug: 'lancamento-2027-01' })).toBe('lancamento-2027-01');
  });

  it('converte datas do YAML (Date) em YYYY-MM-DD', () => {
    const [c] = yaml.load('- name: Futura\n  start: 2026-11-16\n  end: 2026-12-20\n');
    const row = campaignToRow(c, 'pilar');
    expect(row).toMatchObject({ tenant_id: 'pilar', slug: 'futura', start_date: '2026-11-16', end_date: '2026-12-20' });
  });

  it('item sem nome nem slug é ignorado', () => {
    expect(campaignToRow({ pillar: 'dica', context: 'x' }, 'pilar')).toBeNull();
  });

  it('o campaigns.yaml real gera slugs únicos e datas válidas', () => {
    const list = yaml.load(readFileSync('content/campaigns.yaml', 'utf8'));
    const rows = list.map(c => campaignToRow(c, 'pilar')).filter(Boolean);
    const slugs = rows.map(r => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('lancamento-2027-01');
    for (const r of rows) expect(r.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
