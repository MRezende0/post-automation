import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  getQueue,
  getPublished,
  getRejected,
  popNext,
  pushToQueue,
  markPublished,
  markRejected,
} from '../src/utils/queue.js';

let tempDir;
let originalCwd;

describe('queue utils', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'queue-test-'));
    await mkdir(path.join(tempDir, 'content'), { recursive: true });
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('retorna array vazio quando queue.yaml não existe', async () => {
    const q = await getQueue();
    expect(q).toEqual([]);
  });

  it('escreve e lê item da queue', async () => {
    await pushToQueue({ pillar: 'dor', angle: 'tempo' });
    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].pillar).toBe('dor');
  });

  it('popNext remove e retorna primeiro item', async () => {
    await pushToQueue({ pillar: 'dor' });
    await pushToQueue({ pillar: 'dica' });
    const first = await popNext();
    expect(first.pillar).toBe('dor');
    const remaining = await getQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].pillar).toBe('dica');
  });

  it('popNext retorna null quando vazio', async () => {
    const next = await popNext();
    expect(next).toBeNull();
  });

  it('markPublished move pra published.yaml com timestamp', async () => {
    const item = { pillar: 'dor', angle: 'tempo' };
    await markPublished(item, { chosenVariationId: 1, channels: ['instagram'] });
    const published = await getPublished();
    expect(published).toHaveLength(1);
    expect(published[0].chosen_variation).toBe(1);
    expect(published[0].published_at).toBeDefined();
  });

  it('markRejected guarda motivo', async () => {
    await markRejected({ pillar: 'dor' }, 'tom errado');
    const rejected = await getRejected();
    expect(rejected[0].reason).toBe('tom errado');
  });
});
