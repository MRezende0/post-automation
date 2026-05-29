import { describe, it, expect } from 'vitest';
import { judgeFromScores } from '../src/utils/../generate.js';

const VARS = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe('judgeFromScores', () => {
  it('escolhe a de maior total ponderado', () => {
    const scores = [
      { id: 1, hook_stop: 5, especificidade: 5, fit_voz: 5, prova: 5 },        // 50
      { id: 2, hook_stop: 9, especificidade: 9, fit_voz: 8, prova: 8 },        // 86
      { id: 3, hook_stop: 3, especificidade: 3, fit_voz: 3, prova: 3 },        // 30
    ];
    const v = judgeFromScores(scores, VARS);
    expect(v.chosenId).toBe(2);
    expect(v.scores[0].id).toBe(2);
    expect(v.reason).toContain('hook 9');
  });

  it('hook e especificidade pesam mais que voz/prova', () => {
    const scores = [
      { id: 1, hook_stop: 10, especificidade: 10, fit_voz: 0, prova: 0 }, // 60
      { id: 2, hook_stop: 0, especificidade: 0, fit_voz: 10, prova: 10 }, // 40
    ];
    expect(judgeFromScores(scores, [{ id: 1 }, { id: 2 }]).chosenId).toBe(1);
  });

  it('preserva expected_engagement pra calibração', () => {
    const v = judgeFromScores([{ id: 1, hook_stop: 5, especificidade: 5, fit_voz: 5, prova: 5, expected_engagement: 72 }], [{ id: 1 }]);
    expect(v.scores[0].expected_engagement).toBe(72);
  });

  it('ignora ids inexistentes; null se nenhum válido', () => {
    expect(judgeFromScores([{ id: 99, hook_stop: 9 }], VARS)).toBeNull();
    expect(judgeFromScores([], VARS)).toBeNull();
    expect(judgeFromScores(null, VARS)).toBeNull();
  });
});
