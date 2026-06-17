import { earnEntQuestionPoints, computeEntTotalErrors } from '@bilimland/shared';

describe('computeEntTotalErrors', () => {
  it('returns 0 for exact match', () => {
    expect(computeEntTotalErrors(['a', 'b'], ['a', 'b'])).toBe(0);
    expect(computeEntTotalErrors(['a'], ['a'])).toBe(0);
    expect(computeEntTotalErrors(['1', '2', '3'], ['1', '2', '3'])).toBe(0);
  });

  it('counts missing correct answers', () => {
    // 2 correct, selected 1 — 1 missing, 0 extra
    expect(computeEntTotalErrors(['a', 'b'], ['a'])).toBe(1);
    // 3 correct, selected 1 — 2 missing, 0 extra
    expect(computeEntTotalErrors(['1', '2', '3'], ['1'])).toBe(2);
  });

  it('counts extra wrong answers', () => {
    // 1 correct, selected correct + 1 extra — 0 missing, 1 extra
    expect(computeEntTotalErrors(['a'], ['a', 'b'])).toBe(1);
    // 1 correct, selected correct + 2 extra — 0 missing, 2 extra
    expect(computeEntTotalErrors(['a'], ['a', 'b', 'c'])).toBe(2);
  });

  it('counts both missing and extra', () => {
    // 2 correct [a,b], selected [a,c] — missing b, extra c → 2 errors
    expect(computeEntTotalErrors(['a', 'b'], ['a', 'c'])).toBe(2);
  });

  it('handles empty selection', () => {
    expect(computeEntTotalErrors(['a', 'b'], [])).toBe(2); // 2 missing, 0 extra
    expect(computeEntTotalErrors(['a'], [])).toBe(1);       // 1 missing, 0 extra
  });
});

describe('earnEntQuestionPoints — 1 правильный ответ', () => {
  const wMax = 2;

  it('точное совпадение → 2 балла', () => {
    const r = earnEntQuestionPoints(wMax, ['A'], ['A']);
    expect(r.earned).toBe(2);
    expect(r.errors).toBe(0);
  });

  it('неправильный вариант → 0 баллов', () => {
    const r = earnEntQuestionPoints(wMax, ['A'], ['B']);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(2); // missing A, extra B
  });

  it('правильный + лишний → 0 баллов', () => {
    const r = earnEntQuestionPoints(wMax, ['A'], ['A', 'B']);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(1); // extra B only (A is present)
  });

  it('пустой ответ → 0 баллов', () => {
    const r = earnEntQuestionPoints(wMax, ['A'], []);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(1); // missing A
  });

  it('несколько лишних → 0 баллов', () => {
    const r = earnEntQuestionPoints(wMax, ['A'], ['B', 'C']);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(3); // missing A, extra B, extra C
  });
});

describe('earnEntQuestionPoints — 2 правильных ответа', () => {
  const wMax = 2;

  it('оба правильных → 2 балла (0 ошибок)', () => {
    const r = earnEntQuestionPoints(wMax, ['A', 'B'], ['A', 'B']);
    expect(r.earned).toBe(2);
    expect(r.errors).toBe(0);
  });

  it('1 из 2 → 1 балл (1 ошибка: missing)', () => {
    const r = earnEntQuestionPoints(wMax, ['A', 'B'], ['A']);
    expect(r.earned).toBe(1);
    expect(r.errors).toBe(1);
  });

  it('оба + 1 лишний → 1 балл (1 ошибка: extra)', () => {
    const r = earnEntQuestionPoints(wMax, ['A', 'B'], ['A', 'B', 'C']);
    expect(r.earned).toBe(1);
    expect(r.errors).toBe(1);
  });

  it('1 правильный + 1 лишний → 0 баллов (2 ошибки)', () => {
    const r = earnEntQuestionPoints(wMax, ['A', 'B'], ['A', 'C']);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(2);
  });

  it('оба мимо → 0 баллов', () => {
    const r = earnEntQuestionPoints(wMax, ['A', 'B'], ['C', 'D']);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(4); // missing A,B, extra C,D
  });

  it('пустой ответ → 0 баллов', () => {
    const r = earnEntQuestionPoints(wMax, ['A', 'B'], []);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(2); // missing A,B
  });
});

describe('earnEntQuestionPoints — 3 правильных ответа', () => {
  const wMax = 2;

  it('все 3 правильных → 2 балла (0 ошибок)', () => {
    const r = earnEntQuestionPoints(wMax, ['1', '2', '3'], ['1', '2', '3']);
    expect(r.earned).toBe(2);
    expect(r.errors).toBe(0);
  });

  it('2 из 3 → 1 балл (1 ошибка: missing)', () => {
    const r = earnEntQuestionPoints(wMax, ['1', '2', '3'], ['1', '2']);
    expect(r.earned).toBe(1);
    expect(r.errors).toBe(1);
  });

  it('все 3 + 1 лишний → 1 балл (1 ошибка: extra)', () => {
    const r = earnEntQuestionPoints(wMax, ['1', '2', '3'], ['1', '2', '3', '4']);
    expect(r.earned).toBe(1);
    expect(r.errors).toBe(1);
  });

  it('1 из 3 → 0 баллов (2 ошибки)', () => {
    const r = earnEntQuestionPoints(wMax, ['1', '2', '3'], ['1']);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(2); // missing 2,3
  });

  it('1 правильный + 2 лишних → 0 баллов', () => {
    const r = earnEntQuestionPoints(wMax, ['1', '2', '3'], ['1', '4', '5']);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(4); // missing 2,3 + extra 4,5
  });

  it('пустой ответ → 0 баллов', () => {
    const r = earnEntQuestionPoints(wMax, ['1', '2', '3'], []);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(3); // missing 1,2,3
  });
});

describe('earnEntQuestionPoints — 1-балльные задачи (wMax=1)', () => {
  it('exact match → 1 балл', () => {
    const r = earnEntQuestionPoints(1, ['A'], ['A']);
    expect(r.earned).toBe(1);
    expect(r.errors).toBe(0);
  });

  it('неправильный → 0 баллов (даже с 1 ошибкой)', () => {
    const r = earnEntQuestionPoints(1, ['A'], ['B']);
    expect(r.earned).toBe(0);
  });

  it('exact match для 2+ правильных в 1-балльной задаче → 1 балл', () => {
    const r = earnEntQuestionPoints(1, ['A', 'B'], ['A', 'B']);
    expect(r.earned).toBe(1);
    expect(r.errors).toBe(0);
  });

  it('1 ошибка в 1-балльной задаче → 0 баллов', () => {
    const r = earnEntQuestionPoints(1, ['A', 'B'], ['A']);
    expect(r.earned).toBe(0);
    expect(r.errors).toBe(1);
  });
});
