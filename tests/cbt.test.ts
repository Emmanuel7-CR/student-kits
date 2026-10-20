import { describe, expect, it } from 'vitest';
import { buildQuiz, clock, mulberry32, parseQuestions, score, shuffle, verdict, type Question } from '../src/lib/cbt';
import data from '../src/data/cbt.json';

describe('parseQuestions', () => {
  it('parses a star-marked question with explanation', () => {
    const r = parseQuestions(`Q: Which organ pumps blood?
A) Liver
B) Heart*
C) Lung
Explanation: The heart is a muscular pump.`);
    expect(r.errors).toEqual([]);
    expect(r.questions).toEqual([{ q: 'Which organ pumps blood?', options: ['Liver', 'Heart', 'Lung'], answer: 1, explanation: 'The heart is a muscular pump.' }]);
  });
  it('accepts numbered questions and an Answer line', () => {
    const r = parseQuestions(`1. 2 + 2 = ?
a. 3
b. 4
c. 5
Answer: B

2. Capital of Nigeria?
A) Lagos
B) Abuja
C) Kano
Ans: b`);
    expect(r.errors).toEqual([]);
    expect(r.questions.map((q) => q.answer)).toEqual([1, 1]);
  });
  it('supports "(correct)" and wrapped lines', () => {
    const r = parseQuestions(`Q: A very long question
that wraps onto a second line?
A) First option
that also wraps
B) Second (correct)`);
    expect(r.errors).toEqual([]);
    expect(r.questions[0].q).toBe('A very long question that wraps onto a second line?');
    expect(r.questions[0].options).toEqual(['First option that also wraps', 'Second']);
    expect(r.questions[0].answer).toBe(1);
  });
  it('reports problems per question and keeps the good ones', () => {
    const r = parseQuestions(`Q: No answer marked
A) One
B) Two

Q: Only one option
A) Lonely*

Q: Two stars
A) One*
B) Two*

Q: Fine one
A) Yes*
B) No`);
    expect(r.questions).toHaveLength(1);
    expect(r.errors).toHaveLength(3);
    expect(r.errors[0]).toMatch(/does not say which option is correct/);
    expect(r.errors[1]).toMatch(/at least two options/);
    expect(r.errors[2]).toMatch(/more than one correct/);
  });
  it('flags an answer letter that does not exist and duplicates', () => {
    expect(parseQuestions('Q: x?\nA) a\nB) b\nAnswer: D').errors[0]).toMatch(/no option D/);
    expect(parseQuestions('Q: x?\nA) same*\nB) Same').errors[0]).toMatch(/identical/);
  });
  it('handles empty and stray input', () => {
    expect(parseQuestions('').errors[0]).toMatch(/No questions found/);
    expect(parseQuestions('hello there').errors[0]).toMatch(/outside a question/);
    expect(parseQuestions('x'.repeat(200_001)).errors[0]).toMatch(/too much/);
  });
  it('does not treat an option line as a new numbered question', () => {
    const r = parseQuestions('1. Pick one\nA) 1. first*\nB) 2. second');
    expect(r.errors).toEqual([]);
    expect(r.questions[0].options).toEqual(['1. first', '2. second']);
  });
});

describe('engine', () => {
  const qs: Question[] = [0, 1, 2, 3, 4, 5].map((i) => ({ q: `Q${i}`, options: ['a', 'b', 'c', 'd'], answer: i % 4 }));
  it('shuffle keeps every item and is repeatable with a seed', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7], mulberry32(42));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7], mulberry32(42));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('buildQuiz keeps the right answer pointing at the right text', () => {
    for (let seed = 1; seed < 30; seed++) {
      const quiz = buildQuiz(qs, { rng: mulberry32(seed) });
      for (const item of quiz) {
        const original = qs.find((x) => x.q === item.q)!;
        expect(item.options[item.answer]).toBe(original.options[original.answer]);
      }
    }
  });
  it('limits the count and can keep order', () => {
    expect(buildQuiz(qs, { count: 3 })).toHaveLength(3);
    expect(buildQuiz(qs, { shuffleQuestions: false, shuffleOptions: false }).map((x) => x.q)).toEqual(qs.map((x) => x.q));
  });
  it('does not change the original questions', () => {
    const copy = JSON.stringify(qs);
    buildQuiz(qs, { rng: mulberry32(7) });
    expect(JSON.stringify(qs)).toBe(copy);
  });
  it('scores correct, wrong and skipped answers', () => {
    const items: Question[] = [
      { q: 'a', options: ['x', 'y'], answer: 0 },
      { q: 'b', options: ['x', 'y'], answer: 1 },
      { q: 'c', options: ['x', 'y'], answer: 0 },
      { q: 'd', options: ['x', 'y'], answer: 1 },
    ];
    expect(score(items, [0, 0, null, 1])).toEqual({ total: 4, correct: 2, wrong: 1, skipped: 1, percent: 50, missed: [1, 2] });
    expect(score([], [])).toMatchObject({ total: 0, percent: 0 });
  });
  it('formats clocks and verdicts', () => {
    expect(clock(65)).toBe('1:05');
    expect(clock(3725)).toBe('1:02:05');
    expect(clock(-5)).toBe('0:00');
    expect(verdict(80)).toBe('Strong result');
    expect(verdict(55)).toBe('Getting there');
    expect(verdict(10)).toBe('Keep practising');
  });
});

describe('sample sets', () => {
  it('are well formed with one clearly correct answer', () => {
    expect(data.sets.length).toBeGreaterThan(0);
    for (const s of data.sets) {
      expect(s.questions.length, s.id).toBeGreaterThanOrEqual(10);
      for (const q of s.questions) {
        expect(q.options.length, q.q).toBe(4);
        expect(new Set(q.options).size, q.q).toBe(4);
        expect(q.answer, q.q).toBeGreaterThanOrEqual(0);
        expect(q.answer, q.q).toBeLessThan(4);
        expect(q.explanation, q.q).toBeTruthy();
      }
    }
  });
  it('are labelled as samples, not past questions', () => {
    expect(data.note).toMatch(/not past questions/i);
    for (const s of data.sets) expect(s.title).toMatch(/sample/i);
  });
});
