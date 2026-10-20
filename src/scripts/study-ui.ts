import { daysUntil, makePlan, MAX_EXAMS, planAsText, type Exam } from '../lib/study';
import { $, copyText, el, loadJSON, saveJSON } from './dom';

const KEY = 'fsk:study:v1';
interface Row {
  subject: string;
  date: string;
  difficulty: 1 | 2 | 3;
}
interface State {
  rows: Row[];
  hours: number;
  rest: number;
  today: string;
}
const isState = (v: unknown): v is State => {
  const s = v as State;
  return (
    !!s &&
    Array.isArray(s.rows) &&
    s.rows.length <= MAX_EXAMS &&
    s.rows.every((r) => r && typeof r.subject === 'string' && typeof r.date === 'string' && [1, 2, 3].includes(r.difficulty)) &&
    typeof s.hours === 'number' &&
    Number.isInteger(s.rest) &&
    s.rest >= -1 &&
    s.rest <= 6 &&
    typeof s.today === 'string'
  );
};

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let state: State = loadJSON<State>(KEY, { rows: [], hours: 4, rest: -1, today: '' }, isState);
if (!state.rows.length) state.rows.push({ subject: '', date: '', difficulty: 2 });

const examsEl = $('#sp-exams');
const hoursEl = $('#sp-hours') as HTMLSelectElement;
const restEl = $('#sp-rest') as HTMLSelectElement;
const todayEl = $('#sp-today') as HTMLInputElement;
const msg = $('#sp-msg');
const counts = $('#sp-counts');
const out = $('#sp-out');
const tbody = $('#sp-table tbody');
const totals = $('#sp-totals');

for (let h = 1; h <= 10; h += 0.5) hoursEl.append(el('option', { value: String(h) }, `${h} hour${h === 1 ? '' : 's'}`));
hoursEl.value = String(state.hours);
if (hoursEl.value !== String(state.hours)) hoursEl.value = '4';
restEl.value = String(state.rest);
// "Start from" always begins at today's date on a new visit, so an old saved date is not reused by mistake.
todayEl.value = localToday();

let timer: number | undefined;
function save() {
  state.hours = Number(hoursEl.value);
  state.rest = Number(restEl.value);
  saveJSON(KEY, state);
}
function saveSoon() {
  window.clearTimeout(timer);
  timer = window.setTimeout(save, 400);
}
function flush() {
  window.clearTimeout(timer);
  save();
}
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

function renderRows() {
  examsEl.replaceChildren(
    ...state.rows.map((r, i) => {
      const subject = el('input', { class: 'input', type: 'text', maxLength: 60, value: r.subject, placeholder: 'Subject, e.g. Anatomy', 'aria-label': `Exam ${i + 1} subject` }) as HTMLInputElement;
      const date = el('input', { class: 'input', type: 'date', value: r.date, 'aria-label': `Exam ${i + 1} date` }) as HTMLInputElement;
      const diff = el(
        'select',
        { class: 'select', 'aria-label': `Exam ${i + 1} difficulty` },
        el('option', { value: '1' }, 'Easy'),
        el('option', { value: '2' }, 'Medium'),
        el('option', { value: '3' }, 'Hard'),
      ) as HTMLSelectElement;
      diff.value = String(r.difficulty);
      const remove = el('button', { type: 'button', class: 'btn btn-quiet', 'aria-label': `Remove exam ${i + 1}` }, 'Remove');
      subject.addEventListener('input', () => {
        r.subject = subject.value;
        changed();
      });
      date.addEventListener('input', () => {
        r.date = date.value;
        changed();
      });
      diff.addEventListener('change', () => {
        r.difficulty = Number(diff.value) as 1 | 2 | 3;
        changed();
      });
      remove.addEventListener('click', () => {
        state.rows.splice(i, 1);
        if (!state.rows.length) state.rows.push({ subject: '', date: '', difficulty: 2 });
        renderRows();
        changed();
      });
      return el('div', { class: 'grid gap-2 rounded-lg border border-border p-3' }, subject, el('div', { class: 'grid grid-cols-[1fr_7rem] gap-2' }, date, diff), el('div', {}, remove));
    }),
  );
}

$('#sp-add').addEventListener('click', () => {
  if (state.rows.length >= MAX_EXAMS) {
    msg.textContent = `You can add up to ${MAX_EXAMS} exams.`;
    return;
  }
  state.rows.push({ subject: '', date: '', difficulty: 2 });
  renderRows();
  (examsEl.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus();
});

let lastText = '';
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pretty = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

function render() {
  const todayStr = todayEl.value || localToday();
  const exams: Exam[] = state.rows.filter((r) => r.subject.trim() && r.date).map((r) => ({ subject: r.subject.trim(), date: r.date, difficulty: r.difficulty }));
  const incomplete = state.rows.filter((r) => (r.subject.trim() && !r.date) || (!r.subject.trim() && r.date)).length;

  // Countdown
  const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));
  counts.replaceChildren(
    ...sorted.map((e) => {
      const n = daysUntil(e.date, todayStr);
      const label = n === null ? '' : n < 0 ? 'Passed' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n} days`;
      return el('div', { class: 'card' }, el('p', { class: 'text-sm text-muted' }, `${e.subject} · ${pretty(e.date)}`), el('p', { class: 'text-2xl font-extrabold' }, label));
    }),
  );

  const plan = makePlan(exams, { today: todayStr, hoursPerDay: Number(hoursEl.value), restWeekday: Number(restEl.value) });
  const notes = [...plan.warnings];
  if (incomplete) notes.push(`${incomplete} exam row${incomplete === 1 ? ' needs' : 's need'} both a subject and a date.`);
  msg.textContent = notes.join(' ');

  if (!plan.days.length) {
    out.hidden = true;
    lastText = '';
    return;
  }
  out.hidden = false;
  totals.textContent = 'Total study time: ' + plan.totals.map((t) => `${t.subject} ${t.hours}h`).join(', ');
  tbody.replaceChildren(
    ...plan.days.map((d) => {
      const parts: (Node | string)[] = [];
      if (d.exams.length) parts.push(el('strong', {}, `Exam: ${d.exams.join(', ')}`));
      if (d.rest) parts.push('Rest day');
      else if (d.slots.length) parts.push((parts.length ? ' · ' : '') + d.slots.map((s) => `${s.subject} ${s.hours}h`).join(', '));
      return el('tr', {}, el('td', { class: 'border border-border p-2 align-top whitespace-nowrap' }, `${dayNames[d.weekday].slice(0, 3)} ${pretty(d.date)}`), el('td', { class: 'border border-border p-2' }, ...parts));
    }),
  );
  lastText = planAsText(plan);
}

function changed() {
  saveSoon();
  render();
}
for (const f of [hoursEl, restEl, todayEl]) f.addEventListener('input', changed);

$('#sp-print').addEventListener('click', () => window.print());
const copyBtn = $('#sp-copy') as HTMLButtonElement;
copyBtn.addEventListener('click', async () => {
  const ok = await copyText(lastText);
  const keep = copyBtn.lastChild;
  copyBtn.append(ok ? ' Copied' : ' Could not copy');
  setTimeout(() => {
    while (copyBtn.lastChild && copyBtn.lastChild !== keep) copyBtn.removeChild(copyBtn.lastChild);
  }, 1800);
});

renderRows();
render();
