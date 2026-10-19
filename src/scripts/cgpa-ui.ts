import {
  classify,
  cumulativeStats,
  plan,
  remapGrades,
  round2,
  semesterStats,
  SCALES,
  type Course,
  type ScaleId,
  type Semester,
} from '../lib/cgpa';
import { $, copyText, el, loadJSON, parseNum, saveJSON, uid } from './dom';

/* ---------- state ---------- */

interface UiCourse {
  id: string;
  name: string;
  units: string;
  grade: string;
}
interface UiSemester {
  id: string;
  name: string;
  courses: UiCourse[];
}
interface State {
  v: 1;
  scale: ScaleId;
  priorUnits: string;
  priorCgpa: string;
  semesters: UiSemester[];
  planCgpa: string;
  planUnits: string;
  planNext: string;
  planTarget: string;
}

const KEY = 'fsk:cgpa:v1';
const MAX_SEMESTERS = 20;
const MAX_COURSES = 30;

const newCourse = (): UiCourse => ({ id: uid(), name: '', units: '', grade: '' });
const newSemester = (n: number): UiSemester => ({
  id: uid(),
  name: `Semester ${n}`,
  courses: [newCourse(), newCourse(), newCourse(), newCourse()],
});

function defaults(): State {
  return {
    v: 1,
    scale: '5',
    priorUnits: '',
    priorCgpa: '',
    semesters: [newSemester(1)],
    planCgpa: '',
    planUnits: '',
    planNext: '',
    planTarget: '',
  };
}

const isStr = (v: unknown): v is string => typeof v === 'string';

function isState(v: unknown): v is State {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (s.v !== 1 || (s.scale !== '4' && s.scale !== '5')) return false;
  if (![s.priorUnits, s.priorCgpa, s.planCgpa, s.planUnits, s.planNext, s.planTarget].every(isStr)) return false;
  if (!Array.isArray(s.semesters) || s.semesters.length === 0 || s.semesters.length > MAX_SEMESTERS) return false;
  return s.semesters.every((sem: unknown) => {
    const o = sem as Record<string, unknown>;
    return (
      o &&
      isStr(o.id) &&
      isStr(o.name) &&
      o.name.length <= 80 &&
      Array.isArray(o.courses) &&
      o.courses.length <= MAX_COURSES &&
      o.courses.every((c: unknown) => {
        const k = c as Record<string, unknown>;
        return k && isStr(k.id) && isStr(k.name) && k.name.length <= 120 && isStr(k.units) && isStr(k.grade);
      })
    );
  });
}

let state: State = loadJSON<State>(KEY, defaults(), isState);

function persist() {
  const ok = saveJSON(KEY, state);
  const note = document.getElementById('save-note');
  if (note) {
    note.textContent = ok
      ? 'Saved on this device only. Nothing is sent anywhere.'
      : 'Could not save on this device (private browsing or blocked storage). Your numbers stay until you leave this page.';
  }
}

/* ---------- conversions ---------- */

function toCourses(list: UiCourse[]): Course[] {
  return list.map((c) => ({ id: c.id, name: c.name, units: parseNum(c.units), grade: c.grade }));
}
function toSemesters(): Semester[] {
  return state.semesters.map((s) => ({ id: s.id, name: s.name, courses: toCourses(s.courses) }));
}
function prior() {
  const units = parseNum(state.priorUnits);
  const cgpa = parseNum(state.priorCgpa);
  if (!Number.isFinite(units) || !Number.isFinite(cgpa)) return null;
  return { units, cgpa };
}
const f2 = (n: number) => round2(n).toFixed(2);

/* ---------- rendering ---------- */

const semestersEl = $('#semesters');
const gradeKeyEl = $('#grade-key');
const scaleNoteEl = $('#scale-note');
const noticeEl = $('#scale-notice');

function renderScale() {
  const scale = SCALES[state.scale];
  document.querySelectorAll<HTMLInputElement>('input[name="scale"]').forEach((r) => {
    r.checked = r.value === state.scale;
  });
  gradeKeyEl.textContent = scale.grades.map((g) => `${g.letter} = ${g.points}`).join('   ');
  scaleNoteEl.textContent = scale.note;
  $('#plan-max').textContent = String(scale.max);
}

function gradeSelect(course: UiCourse): HTMLSelectElement {
  const scale = SCALES[state.scale];
  const sel = el(
    'select',
    {
      class: 'select',
      'aria-label': 'Grade',
      onchange: (e: Event) => {
        course.grade = (e.target as HTMLSelectElement).value;
        update();
      },
    },
    el('option', { value: '' }, 'Grade'),
    ...scale.grades.map((g) => el('option', { value: g.letter }, `${g.letter} (${g.points})`)),
  );
  sel.value = course.grade;
  return sel;
}

function courseRow(sem: UiSemester, course: UiCourse): HTMLElement {
  return el(
    'div',
    { class: 'course-row' },
    el('input', {
      class: 'input c-name',
      type: 'text',
      placeholder: 'Course (optional)',
      'aria-label': 'Course name',
      maxLength: 120,
      value: course.name,
      oninput: (e: Event) => {
        course.name = (e.target as HTMLInputElement).value;
        persist();
      },
    }),
    el('input', {
      class: 'input',
      type: 'number',
      inputMode: 'numeric',
      min: '0',
      max: '30',
      step: '1',
      placeholder: 'Units',
      'aria-label': 'Credit units',
      value: course.units,
      oninput: (e: Event) => {
        course.units = (e.target as HTMLInputElement).value;
        update();
      },
    }),
    gradeSelect(course),
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet btn-icon',
        'aria-label': 'Remove this course',
        title: 'Remove course',
        onclick: () => {
          sem.courses = sem.courses.filter((c) => c.id !== course.id);
          renderSemesters();
          update();
        },
      },
      icon('trash'),
    ),
  );
}

function icon(name: string): SVGElement {
  const paths: Record<string, string> = {
    trash:
      '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths[name] ?? ''; // fixed strings above, never user input
  return svg;
}

function semesterCard(sem: UiSemester, index: number): HTMLElement {
  const gpaEl = el('span', { class: 'badge', 'data-gpa': sem.id }, '');
  const rows = el('div', { class: 'mt-3 space-y-2' });
  rows.append(
    el(
      'div',
      { class: 'course-head', 'aria-hidden': 'true' },
      el('span', {}, 'Course (optional)'),
      el('span', {}, 'Units'),
      el('span', {}, 'Grade'),
      el('span', {}),
    ),
  );
  sem.courses.forEach((c) => rows.append(courseRow(sem, c)));

  return el(
    'section',
    { class: 'card', 'aria-label': sem.name || `Semester ${index + 1}` },
    el(
      'div',
      { class: 'flex flex-wrap items-center gap-2' },
      el('input', {
        class: 'input max-w-xs flex-1 font-semibold',
        type: 'text',
        'aria-label': 'Semester name',
        maxLength: 80,
        value: sem.name,
        oninput: (e: Event) => {
          sem.name = (e.target as HTMLInputElement).value;
          persist();
        },
      }),
      gpaEl,
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet ml-auto',
          onclick: () => {
            if (state.semesters.length === 1) {
              sem.courses = [newCourse(), newCourse(), newCourse(), newCourse()];
              sem.name = 'Semester 1';
            } else {
              state.semesters = state.semesters.filter((s) => s.id !== sem.id);
            }
            renderSemesters();
            update();
          },
        },
        icon('trash'),
        state.semesters.length === 1 ? 'Clear semester' : 'Remove semester',
      ),
    ),
    rows,
    el(
      'div',
      { class: 'mt-3' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            if (sem.courses.length >= MAX_COURSES) return;
            sem.courses.push(newCourse());
            renderSemesters();
            update();
            const names = semestersEl.children[index]?.querySelectorAll<HTMLInputElement>('.c-name');
            names?.[names.length - 1]?.focus();
          },
        },
        icon('plus'),
        'Add course',
      ),
    ),
  );
}

function renderSemesters() {
  semestersEl.replaceChildren(...state.semesters.map((s, i) => semesterCard(s, i)));
}

/* ---------- results ---------- */

const cgpaEl = $('#cgpa-value');
const classEl = $('#cgpa-class');
const detailEl = $('#cgpa-detail');
const planOut = $('#plan-out');
const miniEl = $('#mini-result');
const miniValue = $('#mini-value');
const miniClass = $('#mini-class');

function updateResults() {
  const scaleId = state.scale;
  const sems = toSemesters();

  // per-semester badges
  for (const s of sems) {
    const st = semesterStats(s.courses, scaleId);
    const badge = semestersEl.querySelector<HTMLElement>(`[data-gpa="${s.id}"]`);
    if (badge) badge.textContent = st.counted ? `GPA ${f2(st.gpa)} · ${st.units} units` : 'No grades yet';
  }

  const total = cumulativeStats(sems, scaleId, prior());
  if (total.units === 0) {
    cgpaEl.textContent = '–';
    classEl.textContent = 'Enter units and grades to see your CGPA.';
    detailEl.textContent = '';
    miniEl.hidden = true;
  } else {
    cgpaEl.textContent = f2(total.gpa);
    classEl.textContent = classify(total.gpa, scaleId);
    miniEl.hidden = false;
    miniValue.textContent = `CGPA ${f2(total.gpa)}`;
    miniClass.textContent = classify(total.gpa, scaleId);
    detailEl.textContent = `${total.units} credit units${total.counted ? ` · ${total.counted} graded courses` : ''} · out of ${SCALES[scaleId].max}.0`;
  }
  updatePlan();
}

function updatePlan() {
  const scaleId = state.scale;
  const filled = [state.planCgpa, state.planUnits, state.planNext, state.planTarget].every((v) => v.trim() !== '');
  planOut.className = 'result-box mt-4';
  if (!filled) {
    planOut.textContent = 'Fill in all four boxes to see what GPA you need.';
    return;
  }
  const r = plan({
    currentCgpa: parseNum(state.planCgpa),
    currentUnits: parseNum(state.planUnits),
    nextUnits: parseNum(state.planNext),
    target: parseNum(state.planTarget),
    scale: scaleId,
  });
  const target = f2(parseNum(state.planTarget));
  switch (r.kind) {
    case 'invalid':
      planOut.textContent = r.reason;
      break;
    case 'secured':
      planOut.textContent = `Your target of ${target} is already safe: even a 0.00 GPA next semester would keep you at or above it.`;
      break;
    case 'possible':
      planOut.textContent = `You need a GPA of at least ${r.required.toFixed(2)} over the next ${parseNum(state.planNext)} units to finish on ${target} (${classify(parseNum(state.planTarget), scaleId)}).`;
      break;
    case 'impossible':
      planOut.textContent = `Not reachable in one semester: it would need ${r.required.toFixed(2)}, above the ${SCALES[scaleId].max}.0 maximum. The best you can reach next semester is ${r.best.toFixed(2)}.`;
      break;
  }
}

function update() {
  persist();
  updateResults();
}

/* ---------- wiring ---------- */

document.querySelectorAll<HTMLInputElement>('input[name="scale"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    const next = radio.value as ScaleId;
    if (next === state.scale) return;
    const n = remapGrades(state.semesters, next);
    state.scale = next;
    state.planCgpa = '';
    state.planTarget = '';
    noticeEl.textContent =
      n > 0
        ? n === 1
          ? `Switched to the ${SCALES[next].label}. One grade that does not exist on this scale was cleared, so choose it again.`
          : `Switched to the ${SCALES[next].label}. ${n} grades that do not exist on this scale were cleared, so choose them again.`
        : `Switched to the ${SCALES[next].label}. Your letter grades carried over.`;
    renderScale();
    renderSemesters();
    syncInputs();
    update();
  });
});

function bind(id: string, key: 'priorUnits' | 'priorCgpa' | 'planCgpa' | 'planUnits' | 'planNext' | 'planTarget') {
  const input = $(id) as HTMLInputElement;
  input.value = state[key];
  input.addEventListener('input', () => {
    state[key] = input.value;
    update();
  });
}
function syncInputs() {
  (['#prior-units', '#prior-cgpa', '#plan-cgpa', '#plan-units', '#plan-next', '#plan-target'] as const).forEach((id, i) => {
    const keys = ['priorUnits', 'priorCgpa', 'planCgpa', 'planUnits', 'planNext', 'planTarget'] as const;
    ($(id) as HTMLInputElement).value = state[keys[i]];
  });
}
bind('#prior-units', 'priorUnits');
bind('#prior-cgpa', 'priorCgpa');
bind('#plan-cgpa', 'planCgpa');
bind('#plan-units', 'planUnits');
bind('#plan-next', 'planNext');
bind('#plan-target', 'planTarget');

$('#add-semester').addEventListener('click', () => {
  if (state.semesters.length >= MAX_SEMESTERS) return;
  state.semesters.push(newSemester(state.semesters.length + 1));
  renderSemesters();
  update();
});

$('#use-my-numbers').addEventListener('click', () => {
  const total = cumulativeStats(toSemesters(), state.scale, prior());
  if (total.units === 0) {
    planOut.textContent = 'Add some graded courses first, then use this button.';
    return;
  }
  state.planCgpa = f2(total.gpa);
  state.planUnits = String(total.units);
  syncInputs();
  update();
});

function summaryText(): string {
  const sems = toSemesters();
  const scale = SCALES[state.scale];
  const lines = [`CGPA summary (${scale.label})`];
  for (const s of sems) {
    const st = semesterStats(s.courses, state.scale);
    if (st.counted) lines.push(`${s.name || 'Semester'}: GPA ${f2(st.gpa)} (${st.units} units)`);
  }
  const total = cumulativeStats(sems, state.scale, prior());
  if (total.units > 0) {
    lines.push(`Cumulative: ${f2(total.gpa)} / ${scale.max}.0 (${total.units} units) - ${classify(total.gpa, state.scale)}`);
  }
  lines.push('Calculated with FreeStudentKit');
  return lines.join('\n');
}

const copyBtn = $('#copy-summary');
copyBtn.addEventListener('click', async () => {
  const ok = await copyText(summaryText());
  const label = copyBtn.querySelector('span');
  if (label) {
    label.textContent = ok ? 'Copied' : 'Copy not available here';
    setTimeout(() => (label.textContent = 'Copy summary'), 2000);
  }
});

$('#print-page').addEventListener('click', () => window.print());

$('#clear-all').addEventListener('click', () => {
  if (!window.confirm('Clear all semesters and numbers saved on this device?')) return;
  state = defaults();
  noticeEl.textContent = '';
  renderScale();
  renderSemesters();
  syncInputs();
  update();
});

renderScale();
renderSemesters();
update();
