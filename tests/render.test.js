import { describe, it, expect } from 'vitest';
import { _internal } from '../src/render-image.js';

describe('render-image internals', () => {
  describe('applyVars', () => {
    it('substitui placeholders', () => {
      const html = '<div>{{hook}} - {{brand}}</div>';
      const out = _internal.applyVars(html, { hook: 'oi', brand: 'X' });
      expect(out).toContain('oi - X');
    });

    it('escapa HTML', () => {
      const html = '<div>{{hook}}</div>';
      const out = _internal.applyVars(html, { hook: '<script>x</script>' });
      expect(out).not.toContain('<script>x</script>');
      expect(out).toContain('&lt;script&gt;');
    });

    it('usa defaults quando var ausente', () => {
      const html = '<div>{{brand}}</div>';
      const out = _internal.applyVars(html, {});
      expect(out).not.toContain('{{brand}}');
    });

    it('usa body como fallback de subline', () => {
      const html = '<div>{{subline}}</div>';
      const out = _internal.applyVars(html, { body: 'corpo' });
      expect(out).toContain('corpo');
    });

    it('badge default vem do pilar', () => {
      const html = '<div>{{badge}}</div>';
      expect(_internal.applyVars(html, {}, 'building')).toContain('BUILDING IN PUBLIC');
      expect(_internal.applyVars(html, {}, 'prova')).toContain('CLIENTE REAL');
    });

    it('badge explícito sobrescreve o do pilar', () => {
      const html = '<div>{{badge}}</div>';
      const out = _internal.applyVars(html, { badge: 'CUSTOM' }, 'building');
      expect(out).toContain('CUSTOM');
    });
  });

  describe('resolveTemplate', () => {
    it('escolhe template instagram/dor pra pilar dor', () => {
      const file = _internal.resolveTemplate('instagram', 'dor');
      expect(file).toMatch(/instagram\/dor\.html$/);
    });

    it('building e prova têm template próprio', () => {
      expect(_internal.resolveTemplate('instagram', 'building')).toMatch(/instagram\/building\.html$/);
      expect(_internal.resolveTemplate('instagram', 'prova')).toMatch(/instagram\/prova\.html$/);
    });

    it('fallback pra dor quando pilar não tem template específico', () => {
      const file = _internal.resolveTemplate('instagram', 'inexistente');
      expect(file).toMatch(/instagram\/dor\.html$/);
    });

    it('linkedin sempre usa single.html', () => {
      const file = _internal.resolveTemplate('linkedin', 'dica');
      expect(file).toMatch(/linkedin\/single\.html$/);
    });
  });

  describe('DIMENSIONS', () => {
    it('IG é 1080x1350', () => {
      expect(_internal.DIMENSIONS.instagram).toEqual({ width: 1080, height: 1350 });
    });
    it('LinkedIn é 1200x627', () => {
      expect(_internal.DIMENSIONS.linkedin).toEqual({ width: 1200, height: 627 });
    });
  });
});
