import { describe, it, expect } from 'vitest';
import { generatePost, _internal } from '../src/generate.js';

describe('generate.js', () => {
  describe('parseJsonResponse', () => {
    it('parsa JSON puro', () => {
      const out = _internal.parseJsonResponse('{"variations":[{"id":1}]}');
      expect(out.variations).toHaveLength(1);
    });

    it('limpa markdown fence', () => {
      const text = '```json\n{"variations":[{"id":2}]}\n```';
      const out = _internal.parseJsonResponse(text);
      expect(out.variations[0].id).toBe(2);
    });

    it('extrai JSON de meio de texto', () => {
      const text = 'Aqui está: {"variations":[{"id":3}]} fim';
      const out = _internal.parseJsonResponse(text);
      expect(out.variations[0].id).toBe(3);
    });

    it('falha em JSON inválido', () => {
      expect(() => _internal.parseJsonResponse('não é json')).toThrow();
    });
  });

  describe('dry-run', () => {
    it('gera 3 variações mock pra Instagram', async () => {
      const result = await generatePost({ channel: 'instagram', pillar: 'dor', dryRun: true });
      expect(result.variations).toHaveLength(3);
      expect(result.channel).toBe('instagram');
      expect(result.pillar).toBe('dor');
      expect(result.variations[0].hook).toContain('MOCK');
    });

    it('gera 3 variações mock pra LinkedIn', async () => {
      const result = await generatePost({ channel: 'linkedin', pillar: 'dica', dryRun: true });
      expect(result.variations).toHaveLength(3);
      expect(result.channel).toBe('linkedin');
    });

    it('formato carousel quando pilar=dica e canal=instagram', async () => {
      const result = await generatePost({ channel: 'instagram', pillar: 'dica', dryRun: true });
      const carouselVars = result.variations.filter(v => v.format === 'carousel');
      expect(carouselVars.length).toBeGreaterThan(0);
      expect(carouselVars[0].slides).toBeDefined();
    });

    it('rejeita canal inválido', async () => {
      await expect(
        generatePost({ channel: 'twitter', pillar: 'dor', dryRun: true }),
      ).rejects.toThrow(/Canal inválido/);
    });
  });
});
