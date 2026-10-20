/** Quiz engine and a forgiving parser for questions people paste from their own notes. Pure functions. */

export interface Question {
  q: string;
  options: string[];
  /** Index of the correct option. */
  answer: number;
  explanation?: string;
}

export const MAX_QUESTIONS = 300;
export const MAX_TEXT = 200_000;

export interface ParseResult {
  questions: Question[];
  errors: string[];
}

const START = /^(?:q(?:uestion)?\s*\d*\s*[:.)]|\d+\s*[.)])\s*(.*)$/i;
const OPTION = /^\(?([A-Ha-h])[.)]\s+(.+)$/;
const ANSWER = /^(?:answer|ans|correct)\s*[:=-]\s*\(?([A-Ha-h])\)?[.\s]*$/i;
const EXPLAIN = /^(?:explanation|reason|note)\s*[:=-]\s*(.+)$/i;

interface Draft {
  line: number;
  text: string;
  options: { letter: string; text: string; star: boolean }[];
  answerLetter: string | null;
  explanation: string;
  last: 'q' | 'opt' | 'exp';
}

/**
 * Format, one question per block:
 *   Q: Which organ pumps blood?
 *   A) Liver
 *   B) Heart*        <- a star marks the correct option (or write "Answer: B")
 *   C) Lung
 *   Explanation: optional text
 */
export function parseQuestions(input: string): ParseResult {
  const errors: string[] = [];
  const questions: Question[] = [];
  if (input.length > MAX_TEXT) return { questions, errors: ['That is too much text at once. Paste fewer questions.'] };

  let cur: Draft | null = null;

  const flush = () => {
    if (!cur) return;
    const d = cur;
    cur = null;
    const label = `Question at line ${d.line} (“${d.text.slice(0, 40)}${d.text.length > 40 ? '…' : ''}”)`;
    if (!d.text.trim()) return void errors.push(`${label} has no question text.`);
    if (d.options.length < 2) return void errors.push(`${label} needs at least two options like “A) …”.`);
    if (d.options.length > 8) return void errors.push(`${label} has more than 8 options.`);
    const letters = d.options.map((o) => o.letter);
    if (new Set(letters).size !== letters.length) return void errors.push(`${label} repeats an option letter.`);
    const starred = d.options.filter((o) => o.star).map((o) => o.letter);
    const marked = new Set([...starred, ...(d.answerLetter ? [d.answerLetter] : [])]);
    if (marked.size === 0) return void errors.push(`${label} does not say which option is correct. Add a * after it, or a line “Answer: B”.`);
    if (marked.size > 1) return void errors.push(`${label} marks more than one correct option.`);
    const correct = [...marked][0];
    const idx = letters.indexOf(correct);
    if (idx < 0) return void errors.push(`${label} says the answer is ${correct}, but there is no option ${correct}.`);
    const texts = d.options.map((o) => o.text);
    if (new Set(texts.map((t) => t.toLowerCase())).size !== texts.length) return void errors.push(`${label} has two identical options.`);
    questions.push({ q: d.text.trim(), options: texts, answer: idx, ...(d.explanation.trim() ? { explanation: d.explanation.trim() } : {}) });
  };

  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const n = i + 1;

    const ans = ANSWER.exec(line);
    if (ans && cur) {
      cur.answerLetter = ans[1].toUpperCase();
      return;
    }
    const exp = EXPLAIN.exec(line);
    if (exp && cur) {
      cur.explanation = exp[1];
      cur.last = 'exp';
      return;
    }
    const opt = OPTION.exec(line);
    if (opt && cur && cur.text) {
      let text = opt[2].trim();
      let star = false;
      const m = /(?:\s*\*+|\s*\((?:correct|answer)\))$/i.exec(text);
      if (m) {
        star = true;
        text = text.slice(0, m.index).trim();
      }
      cur.options.push({ letter: opt[1].toUpperCase(), text, star });
      cur.last = 'opt';
      return;
    }
    const start = START.exec(line);
    if (start && (!cur || cur.options.length > 0 || cur.last !== 'q' || /^q/i.test(line))) {
      flush();
      cur = { line: n, text: start[1].trim(), options: [], answerLetter: null, explanation: '', last: 'q' };
      return;
    }
    if (!cur) {
      errors.push(`Line ${n} is outside a question. Start each question with “Q:” or a number.`);
      return;
    }
    // A wrapped line: continue whatever came before it.
    if (cur.last === 'q') cur.text += ` ${line}`;
    else if (cur.last === 'opt') cur.options[cur.options.length - 1].text += ` ${line}`;
    else cur.explanation += ` ${line}`;
  });
  flush();

  if (questions.length > MAX_QUESTIONS) {
    return { questions: questions.slice(0, MAX_QUESTIONS), errors: [...errors, `Only the first ${MAX_QUESTIONS} questions were kept.`] };
  }
  if (!questions.length && !errors.length) errors.push('No questions found. Start each one with “Q:” and list options like “A) …”.');
  return { questions, errors };
}

/* ---------- quiz engine ---------- */

export type Rng = () => number;

/** Small seedable generator so shuffles can be tested. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface BuildOptions {
  count?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  rng?: Rng;
}

export function buildQuiz(questions: readonly Question[], o: BuildOptions = {}): Question[] {
  const rng = o.rng ?? Math.random;
  let pool = o.shuffleQuestions === false ? questions.slice() : shuffle(questions, rng);
  if (o.count && o.count > 0) pool = pool.slice(0, o.count);
  return pool.map((q) => {
    if (o.shuffleOptions === false) return { ...q, options: q.options.slice() };
    const order = shuffle(q.options.map((_, i) => i), rng);
    return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
  });
}

export interface Score {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  percent: number;
  /** Indexes of questions answered wrongly or skipped. */
  missed: number[];
}

export function score(items: readonly Question[], answers: readonly (number | null)[]): Score {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const missed: number[] = [];
  items.forEach((q, i) => {
    const a = answers[i];
    if (a === null || a === undefined) {
      skipped++;
      missed.push(i);
    } else if (a === q.answer) correct++;
    else {
      wrong++;
      missed.push(i);
    }
  });
  const total = items.length;
  return { total, correct, wrong, skipped, percent: total ? Math.round((correct / total) * 1000) / 10 : 0, missed };
}

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export function verdict(percent: number): string {
  if (percent >= 70) return 'Strong result';
  if (percent >= 50) return 'Getting there';
  return 'Keep practising';
}
