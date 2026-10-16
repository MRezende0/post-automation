import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { capabilities, canAutoPublish as canNode, publishableFormats } from '../src/channels/capabilities.js';
import { CAPABILITIES, canAutoPublish as canTs, formatCapability, notPublishableReason } from '../platform/src/lib/capabilities.ts';
import { resolveTenant } from '../src/tenant.js';

const MODES = ['auto', 'planned', 'manual'];

describe('matriz de capacidades por rede', () => {
  it('todo formato declara modo válido e rótulo', () => {
    for (const [ch, cap] of Object.entries(capabilities())) {
      expect(['api', 'csv', 'none'], ch).toContain(cap.metrics.source);
      for (const [fmt, f] of Object.entries(cap.formats)) {
        expect(MODES, `${ch}.${fmt}`).toContain(f.publish);
        expect(f.label, `${ch}.${fmt}`).toBeTruthy();
      }
    }
  });

  it('Node e plataforma leem a mesma matriz', () => {
    const json = JSON.parse(readFileSync('platform/src/lib/channel-capabilities.json', 'utf8')).channels;
    expect(CAPABILITIES).toEqual(json);
    for (const [ch, cap] of Object.entries(json)) {
      for (const fmt of [...Object.keys(cap.formats), 'inexistente', null]) {
        expect(canNode(ch, fmt), `${ch}.${fmt}`).toBe(canTs(ch, fmt));
      }
    }
  });

  it('todo formato que o tenant gera publica sozinho na rede', () => {
    const { platforms } = resolveTenant();
    for (const [ch, plat] of Object.entries(platforms)) {
      if (plat.publish === false) continue;
      expect(publishableFormats(ch, plat.formats), ch).toEqual(plat.formats);
    }
  });

  it('formato ausente vale como post simples', () => {
    expect(canTs('instagram', null)).toBe(true);
    expect(formatCapability('linkedin', undefined)?.label).toBe('Texto com imagem');
  });

  it('Reels e story interativo não vão para a API ainda', () => {
    expect(canTs('instagram', 'reel')).toBe(false);
    expect(canTs('instagram', 'story_interativo')).toBe(false);
    expect(notPublishableReason('instagram', 'story_interativo')).toMatch(/não sai pela API/);
    expect(notPublishableReason('instagram', 'reel')).toMatch(/ainda não é publicado/);
    expect(notPublishableReason('instagram', 'gif')).toMatch(/não existe/);
  });
});
