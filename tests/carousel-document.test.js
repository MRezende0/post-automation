import { describe, it, expect } from 'vitest';
import { _internal as render } from '../src/render-image.js';
import { contentTypeFor } from '../src/utils/storage.js';
import { isRenderableCarousel } from '../src/pipeline.js';
import { documentTitle } from '../src/channels/linkedin.js';
import { documentTitle as documentTitleTs } from '../platform/src/lib/channels/linkedin.ts';
import { mediaKindOf } from '../platform/src/lib/scheduling.ts';

describe('carrossel → PDF do LinkedIn', () => {
  it('buildPdfHtml faz uma página por slide no tamanho do slide', () => {
    const html = render.buildPdfHtml(['data:a', 'data:b', 'data:c'], { width: 1080, height: 1350 });
    expect(html.match(/class="page"/g)).toHaveLength(3);
    expect(html).toContain('@page { size: 1080px 1350px; margin: 0; }');
  });

  it('slideVars aceita slide em texto e em objeto', () => {
    expect(render.slideVars('Capa', 0, 7)).toMatchObject({ step: '1/7', title: 'Capa', description: '' });
    expect(render.slideVars({ title: 'T', description: 'D' }, 2, 7)).toMatchObject({ step: '3/7', title: 'T', description: 'D' });
  });

  it('applyVars não deixa undefined apagar o padrão da marca', () => {
    const out = render.applyVars('{{brand}} {{handle}}', { brand: undefined, handle: undefined });
    expect(out).toBe('Pilar @pilar.software');
  });

  it('contentTypeFor reconhece PDF e PNG', () => {
    expect(contentTypeFor('tmp/carousel-1.pdf')).toBe('application/pdf');
    expect(contentTypeFor('tmp/slide.PNG')).toBe('image/png');
    expect(contentTypeFor('x.bin')).toBe('application/octet-stream');
  });

  it('só renderiza carrossel com 2+ slides', () => {
    expect(isRenderableCarousel({ format: 'carousel', slides: ['a', 'b'] })).toBe(true);
    expect(isRenderableCarousel({ format: 'carousel', slides: ['a'] })).toBe(false);
    expect(isRenderableCarousel({ format: 'single', slides: ['a', 'b'] })).toBe(false);
  });

  it('documentTitle encurta o gancho e tem fallback (Node e TS iguais)', () => {
    const long = 'a'.repeat(120);
    for (const fn of [documentTitle, documentTitleTs]) {
      expect(fn('  3 sinais\n de margem  ')).toBe('3 sinais de margem');
      expect(fn(long)).toHaveLength(80);
      expect(fn('')).toBe('Pilar');
    }
  });

  it('mediaKindOf: documento no LinkedIn, carrossel só com slides prontos', () => {
    expect(mediaKindOf('linkedin', { id: 1, format: 'carousel', slideUrls: ['a', 'b'], documentUrl: 'p.pdf' }, null)).toBe('document');
    expect(mediaKindOf('instagram', { id: 1, format: 'carousel', slideUrls: ['a', 'b'] }, 'x.png')).toBe('carousel');
    expect(mediaKindOf('instagram', { id: 1, format: 'carousel' }, 'x.png')).toBe('image');
    expect(mediaKindOf('linkedin', { id: 1, format: 'text' }, null)).toBe('text');
  });
});
