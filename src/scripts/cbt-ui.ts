import data from '../data/cbt.json';
import { buildQuiz, clock, MAX_QUESTIONS, parseQuestions, score, verdict, type Question } from '../lib/cbt';
import { $, el, loadJSON, saveJSON } from './dom';

const OWN_KEY = 'fsk:cbt:own:v1';
const HIST_KEY = 'fsk:cbt:hist:v1';
const LETTERS = 'ABCDEFGH';

interface Attempt {
  set: string;
  at: number;
  correct: number;
  total: number;
  percent: number;
  mode: Mode;
  seconds: number;
}
type Mode = 'practice' | 'exam';

const isQs = (v: unknown): v is Question[] =>
  Array.isArray(v) &&
  v.every(
    (q) =>
      q && typeof q.q === 'string' && Array.isArray(q.options) && q.options.every((o: unknown) => typeof o === 'string') && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
  );
const isHist = (v: unknown): v is Attempt[] => Array.isArray(v) && v.every((a) => a && typeof a.set === 'string' && typeof a.percent === 'number' && typeof a.total === 'number');

const setupEl = $('#cbt-setup');
const runEl = $('#cbt-run');
const resultEl = $('#cbt-result');

function show(view: 'setup' | 'run' | 'result') {
  setupEl.hidden = view !== 'setup';
  runEl.hidden = view !== 'run';
  resultEl.hidden = view !== 'result';
  window.scrollTo({ top: 0 });
}

/* ---------- setup ---------- */
let own: Question[] = loadJSON<Question[]>(OWN_KEY, [], isQs);
let notice: { headline: string; problems: string[]; keep: string } | null = null;
let pick = { set: data.sets[0].id, count: '10', minutes: '10', mode: 'practice' as Mode };

function allSets() {
  const sets = data.sets.map((s) => ({ id: s.id, title: s.title, blurb: s.blurb, questions: s.questions as Question[] }));
  if (own.length) sets.push({ id: 'own', title: 'My own questions', blurb: 'The questions you pasted from your notes.', questions: own });
  return sets;
}

function renderSetup() {
  const sets = allSets();
  if (!sets.some((s) => s.id === pick.set)) pick.set = sets[0].id;
  const chosen = sets.find((s) => s.id === pick.set)!;

  const countOptions = [5, 10, 15, 20, 30, 50].filter((n) => n < chosen.questions.length);
  const counts = [...countOptions.map(String), 'all'];
  if (!counts.includes(pick.count)) pick.count = 'all';

  const select = (id: string, label: string, options: [string, string][], value: string, onChange: (v: string) => void) => {
    const s = el('select', { class: 'select', id }, ...options.map(([v, t]) => el('option', { value: v }, t))) as HTMLSelectElement;
    s.value = value;
    s.addEventListener('change', () => onChange(s.value));
    return el('label', { class: 'field' }, el('span', { class: 'label' }, label), s);
  };

  const history = loadJSON<Attempt[]>(HIST_KEY, [], isHist);

  const ownText = el('textarea', {
    id: 'cbt-own-text',
    'aria-label': 'Paste your questions',
    class: 'textarea',
    rows: 10,
    maxLength: 200000,
    placeholder: 'Q: Which organ pumps blood?\nA) Liver\nB) Heart*\nC) Lung\nExplanation: optional\n\nQ: Next question…',
    'aria-describedby': 'cbt-own-help',
  }) as HTMLTextAreaElement;
  const ownMsg = el('div', { role: 'status', 'aria-live': 'polite', class: 'text-sm', id: 'cbt-own-msg' });
  if (notice) {
    ownMsg.append(el('p', { class: 'font-semibold' }, notice.headline));
    if (notice.problems.length) ownMsg.append(el('ul', { class: 'list-disc pl-5' }, ...notice.problems.map((e) => el('li', {}, e))));
    ownText.value = notice.keep;
    notice = null;
  }
  const saveOwn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Check and save questions') as HTMLButtonElement;
  saveOwn.addEventListener('click', () => {
    const r = parseQuestions(ownText.value);
    const problems = r.errors.slice(0, 8);
    if (!r.questions.length) {
      notice = { headline: 'Nothing was saved.', problems, keep: ownText.value };
      return renderSetup();
    }
    const have = new Set(own.map((x) => x.q.trim().toLowerCase()));
    const fresh = r.questions.filter((x) => !have.has(x.q.trim().toLowerCase()));
    const dupes = r.questions.length - fresh.length;
    own = [...own, ...fresh].slice(0, MAX_QUESTIONS);
    const stored = saveJSON(OWN_KEY, own);
    pick.set = 'own';
    const parts = [`${fresh.length} question${fresh.length === 1 ? '' : 's'} saved${stored ? '' : ' for now only (this browser would not store them)'}`];
    if (dupes) parts.push(`${dupes} already saved, skipped`);
    notice = {
      headline: `${parts.join('. ')}. You now have ${own.length} of your own.${problems.length ? ' Fix the problems below and save again. Questions already saved are skipped.' : ''}`,
      problems,
      keep: problems.length ? ownText.value : '',
    };
    renderSetup();
  });

  const wipe = own.length
    ? (el('button', { type: 'button', class: 'btn btn-quiet' }, `Delete my ${own.length} questions`) as HTMLButtonElement)
    : null;
  wipe?.addEventListener('click', () => {
    if (!window.confirm('Delete all the questions you pasted? This cannot be undone.')) return;
    own = [];
    try {
      localStorage.removeItem(OWN_KEY);
    } catch {
      /* nothing stored */
    }
    renderSetup();
  });

  const start = el('button', { type: 'button', class: 'btn btn-primary' }, 'Start quiz') as HTMLButtonElement;
  start.addEventListener('click', () => startQuiz(chosen.title, chosen.questions));

  const historyCard = history.length
    ? el(
        'section',
        { class: 'card mt-6', 'aria-labelledby': 'cbt-h4' },
        el('h2', { id: 'cbt-h4', class: 'text-lg font-bold' }, 'Your recent scores'),
        el(
          'ul',
          { class: 'mt-2 space-y-1 text-sm' },
          ...history.slice(0, 8).map((a) =>
            el('li', {}, `${new Date(a.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${a.set}, ${a.correct}/${a.total} (${a.percent}%), ${a.mode === 'exam' ? 'exam' : 'practice'}`),
          ),
        ),
      )
    : null;

  setupEl.replaceChildren(
    el(
      'div',
      { class: 'grid gap-6 lg:grid-cols-2' },
      el(
        'section',
        { class: 'card space-y-4', 'aria-labelledby': 'cbt-h1' },
        el('h2', { id: 'cbt-h1', class: 'text-lg font-bold' }, '1. Choose questions'),
        el(
          'fieldset',
          { class: 'space-y-2' },
          el('legend', { class: 'sr-only' }, 'Question set'),
          ...sets.map((s) => {
            const input = el('input', { type: 'radio', name: 'cbt-set', value: s.id, checked: s.id === pick.set }) as HTMLInputElement;
            input.addEventListener('change', () => {
              pick.set = s.id;
              renderSetup();
              ($(`input[name="cbt-set"][value="${s.id}"]`) as HTMLInputElement).focus();
            });
            return el(
              'label',
              { class: 'cbt-opt' },
              input,
              el('span', {}, el('strong', {}, s.title), el('span', { class: 'block text-sm text-muted' }, `${s.blurb} (${s.questions.length} questions)`)),
            );
          }),
        ),
        el('p', { class: 'text-sm text-muted' }, data.note),
      ),
      el(
        'section',
        { class: 'card space-y-4', 'aria-labelledby': 'cbt-h2' },
        el('h2', { id: 'cbt-h2', class: 'text-lg font-bold' }, '2. Set up the quiz'),
        select('cbt-count', 'How many questions', counts.map((c) => [c, c === 'all' ? `All ${chosen.questions.length}` : c]), pick.count, (v) => (pick.count = v)),
        select('cbt-minutes', 'Time limit', [['0', 'No time limit'], ['5', '5 minutes'], ['10', '10 minutes'], ['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour']], pick.minutes, (v) => (pick.minutes = v)),
        select(
          'cbt-mode',
          'Mode',
          [['practice', 'Practice: see the answer after each question'], ['exam', 'Exam: results only at the end']],
          pick.mode,
          (v) => (pick.mode = v as Mode),
        ),
        start,
      ),
    ),
    el(
      'section',
      { class: 'card mt-6 space-y-3', 'aria-labelledby': 'cbt-h3' },
      el('h2', { id: 'cbt-h3', class: 'text-lg font-bold' }, 'Make a quiz from your own notes'),
      el(
        'p',
        { id: 'cbt-own-help', class: 'text-sm text-muted' },
        'Paste questions in this shape. Put a * after the correct option, or add a line like “Answer: B”. Leave a blank line between questions. Anything that does not fit is reported so you can fix it.',
      ),
      ownText,
      el('div', { class: 'flex flex-wrap gap-2' }, saveOwn, wipe),
      ownMsg,
    ),
    ...(historyCard ? [historyCard] : []),
  );
  show('setup');
}

/* ---------- running a quiz ---------- */
let title = '';
let items: Question[] = [];
let answers: (number | null)[] = [];
let revealed: boolean[] = [];
let index = 0;
let mode: Mode = 'practice';
let deadline = 0;
let startedAt = 0;
let ticker: number | undefined;

function startQuiz(name: string, pool: Question[], forcePractice = false) {
  const n = pick.count === 'all' || forcePractice ? pool.length : Number(pick.count);
  title = name;
  items = buildQuiz(pool, { count: n });
  answers = items.map(() => null);
  revealed = items.map(() => false);
  index = 0;
  mode = forcePractice ? 'practice' : pick.mode;
  startedAt = Date.now();
  const minutes = forcePractice ? 0 : Number(pick.minutes);
  deadline = minutes > 0 ? startedAt + minutes * 60_000 : 0;
  window.clearInterval(ticker);
  if (deadline) ticker = window.setInterval(tick, 1000);
  window.onbeforeunload = () => 'Your quiz is in progress.';
  renderRun();
  show('run');
}

function tick() {
  const left = Math.ceil((deadline - Date.now()) / 1000);
  const t = document.getElementById('cbt-timer');
  if (t) t.textContent = clock(left);
  if (left <= 0) finish(true);
}

function chooseOption(i: number) {
  if (mode === 'practice' && revealed[index]) return;
  answers[index] = i;
  if (mode === 'practice') revealed[index] = true;
  renderRun(`cbt-opt-${i}`);
}

function renderRun(focusId?: string) {
  const q = items[index];
  const done = revealed[index];
  const answered = answers.filter((a) => a !== null).length;

  const opts = q.options.map((text, i) => {
    const input = el('input', { type: 'radio', name: 'cbt-answer', id: `cbt-opt-${i}`, value: String(i), checked: answers[index] === i, disabled: mode === 'practice' && done }) as HTMLInputElement;
    input.addEventListener('change', () => chooseOption(i));
    let cls = 'cbt-opt';
    let tag = '';
    if (done) {
      if (i === q.answer) {
        cls += ' is-right';
        tag = answers[index] === i ? 'Your answer: correct' : 'Correct answer';
      } else if (answers[index] === i) {
        cls += ' is-wrong';
        tag = 'Your answer: not correct';
      }
    }
    return el('label', { class: cls }, input, el('span', {}, el('strong', {}, `${LETTERS[i]}. `), text, tag ? el('span', { class: 'block text-sm font-semibold' }, tag) : null));
  });

  const prev = el('button', { type: 'button', class: 'btn', disabled: index === 0 }, 'Previous') as HTMLButtonElement;
  prev.addEventListener('click', () => go(index - 1));
  const last = index === items.length - 1;
  const next = el('button', { type: 'button', class: 'btn btn-primary' }, last ? 'Finish' : 'Next') as HTMLButtonElement;
  next.addEventListener('click', () => (last ? confirmFinish() : go(index + 1)));
  const submit = el('button', { type: 'button', class: 'btn btn-quiet' }, 'Submit now') as HTMLButtonElement;
  submit.addEventListener('click', confirmFinish);

  const nav = el(
    'div',
    { class: 'cbt-nav flex flex-wrap gap-1.5', role: 'group', 'aria-label': 'Jump to a question' },
    ...items.map((_, i) => {
      const b = el('button', { type: 'button', class: 'btn', 'data-state': answers[i] !== null ? 'answered' : '', 'aria-label': `Question ${i + 1}, ${answers[i] !== null ? 'answered' : 'not answered'}`, 'aria-current': i === index ? 'true' : null }, String(i + 1));
      b.addEventListener('click', () => go(i));
      return b;
    }),
  );

  runEl.replaceChildren(
    el(
      'div',
      { class: 'card max-w-3xl space-y-4' },
      el(
        'div',
        { class: 'flex flex-wrap items-center justify-between gap-2 text-sm' },
        el('span', { class: 'font-semibold' }, `${title}: question ${index + 1} of ${items.length}`),
        el('span', { class: 'text-muted' }, `${answered} answered`),
        deadline ? el('span', { id: 'cbt-timer', role: 'timer', class: 'badge badge-warn' }, clock(Math.ceil((deadline - Date.now()) / 1000))) : null,
      ),
      el('fieldset', { class: 'space-y-2' }, el('legend', { class: 'mb-3 text-lg font-bold' }, q.q), ...opts),
      el('p', { class: 'hidden text-xs text-muted sm:block' }, 'Keys: press A, B, C… to choose, N for next, P for previous.'),
      done && q.explanation ? el('p', { class: 'rounded-lg bg-tint p-3 text-sm' }, el('strong', {}, 'Why: '), q.explanation) : null,
      el('div', { class: 'flex flex-wrap items-center gap-2' }, prev, next, submit),
      nav,
    ),
  );
  if (focusId) document.getElementById(focusId)?.focus();
}

function go(i: number) {
  index = Math.min(Math.max(i, 0), items.length - 1);
  renderRun();
  runEl.querySelector('legend')?.scrollIntoView({ block: 'nearest' });
}

function confirmFinish() {
  const skipped = answers.filter((a) => a === null).length;
  if (skipped && !window.confirm(`You have ${skipped} unanswered question${skipped === 1 ? '' : 's'}. Submit anyway?`)) return;
  finish(false);
}

document.addEventListener('keydown', (e) => {
  if (runEl.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t && /^(TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const k = e.key.toUpperCase();
  const pos = LETTERS.indexOf(k);
  if (k.length === 1 && pos >= 0 && pos < items[index].options.length) {
    e.preventDefault();
    chooseOption(pos);
  } else if (k === 'N' && index < items.length - 1) {
    e.preventDefault();
    go(index + 1);
  } else if (k === 'P' && index > 0) {
    e.preventDefault();
    go(index - 1);
  }
});

/* ---------- results ---------- */
function finish(timeUp: boolean) {
  window.clearInterval(ticker);
  window.onbeforeunload = null;
  const s = score(items, answers);
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  const history = loadJSON<Attempt[]>(HIST_KEY, [], isHist);
  saveJSON(HIST_KEY, [{ set: title, at: Date.now(), correct: s.correct, total: s.total, percent: s.percent, mode, seconds }, ...history].slice(0, 20));

  const retry = el('button', { type: 'button', class: 'btn btn-primary' }, `Practise the ${s.missed.length} I missed`) as HTMLButtonElement;
  retry.addEventListener('click', () => {
    const missed = s.missed.map((i) => items[i]);
    startQuiz(`${title} (missed)`, missed, true);
  });
  const again = el('button', { type: 'button', class: 'btn' }, 'Back to setup') as HTMLButtonElement;
  again.addEventListener('click', renderSetup);

  const review = items.map((q, i) => {
    const a = answers[i];
    const ok = a === q.answer;
    return el(
      'li',
      { class: 'card' },
      el('p', { class: 'text-sm font-semibold text-muted' }, `Question ${i + 1}: ${a === null ? 'not answered' : ok ? 'correct' : 'not correct'}`),
      el('p', { class: 'mt-1 font-bold' }, q.q),
      el(
        'ul',
        { class: 'mt-2 space-y-1 text-sm' },
        ...q.options.map((o, j) =>
          el(
            'li',
            { class: j === q.answer ? 'font-semibold' : '' },
            `${LETTERS[j]}. ${o}`,
            j === q.answer ? ' (correct answer)' : '',
            a === j && j !== q.answer ? ' (your answer)' : '',
          ),
        ),
      ),
      q.explanation ? el('p', { class: 'mt-2 text-sm text-muted' }, el('strong', {}, 'Why: '), q.explanation) : null,
    );
  });

  resultEl.replaceChildren(
    el(
      'div',
      { class: 'card max-w-3xl' },
      timeUp ? el('p', { class: 'badge badge-warn mb-2' }, 'Time is up') : null,
      el('h2', { class: 'text-xl font-bold', tabIndex: -1, id: 'cbt-score-h' }, `${verdict(s.percent)}: ${s.correct} out of ${s.total} (${s.percent}%)`),
      el('p', { class: 'mt-1 text-muted' }, `${s.wrong} not correct, ${s.skipped} not answered. Time used: ${clock(seconds)}.`),
      el('div', { class: 'mt-4 flex flex-wrap gap-2' }, s.missed.length ? retry : null, again),
    ),
    el('h3', { class: 'mt-6 text-lg font-bold' }, 'Review your answers'),
    el('ol', { class: 'mt-3 max-w-3xl space-y-3' }, ...review),
  );
  show('result');
  document.getElementById('cbt-score-h')?.focus();
}

renderSetup();
