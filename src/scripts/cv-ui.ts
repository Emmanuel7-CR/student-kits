import { $, el, loadJSON, saveJSON } from './dom';
import { groupEditor, type Row } from './group-editor';

interface CV {
  name: string;
  headline: string;
  email: string;
  phone: string;
  address: string;
  links: string;
  summary: string;
  education: Row[];
  experience: Row[];
  skills: string;
  referees: Row[];
  refereesOnRequest: boolean;
  accent: 'blue' | 'black';
}

const KEY = 'fsk:cv:v1';
const blankEdu = (): Row => ({ school: '', course: '', dates: '', detail: '' });
const blankExp = (): Row => ({ role: '', org: '', dates: '', detail: '' });
const blankRef = (): Row => ({ name: '', role: '', contact: '' });

const fresh = (): CV => ({
  name: '',
  headline: '',
  email: '',
  phone: '',
  address: '',
  links: '',
  summary: '',
  education: [blankEdu()],
  experience: [blankExp()],
  skills: '',
  referees: [],
  refereesOnRequest: true,
  accent: 'blue',
});

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const s = (v: unknown) => (typeof v === 'string' ? v : '');
function rowsOf(v: unknown, blank: () => Row): Row[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObj).map((r) => {
    const out = blank();
    for (const k of Object.keys(out)) out[k] = s(r[k]);
    return out;
  });
}
function load(): CV {
  const base = fresh();
  const raw = loadJSON<Record<string, unknown>>(KEY, {}, isObj);
  return {
    name: s(raw.name),
    headline: s(raw.headline),
    email: s(raw.email),
    phone: s(raw.phone),
    address: s(raw.address),
    links: s(raw.links),
    summary: s(raw.summary),
    education: 'education' in raw ? rowsOf(raw.education, blankEdu) : base.education,
    experience: 'experience' in raw ? rowsOf(raw.experience, blankExp) : base.experience,
    skills: s(raw.skills),
    referees: rowsOf(raw.referees, blankRef),
    refereesOnRequest: raw.refereesOnRequest === false ? false : true,
    accent: raw.accent === 'black' ? 'black' : 'blue',
  };
}

const cv = load();
const preview = $('#cv-preview');
let timer: number | undefined;

function filled(row: Row) {
  return Object.values(row).some((v) => v.trim());
}

function render() {
  const accent = cv.accent === 'black' ? '#111' : '#1f4f86';
  const h = (text: string) =>
    el('h3', { style: `margin:14px 0 4px;padding-bottom:2px;border-bottom:1.5px solid ${accent};font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${accent};` }, text);
  const bullets = (text: string) => {
    const lines = text.split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    return lines.length ? el('ul', { style: 'margin:2px 0 0 18px;padding:0;list-style:disc;' }, ...lines.map((l) => el('li', { style: 'margin:1px 0;' }, l))) : null;
  };
  const entry = (title: string, sub: string, dates: string, detail: string) =>
    el(
      'div',
      { style: 'margin:6px 0;break-inside:avoid;' },
      el('div', { style: 'display:flex;justify-content:space-between;gap:12px;' }, el('strong', {}, title), el('span', { style: 'white-space:nowrap;color:#444;' }, dates)),
      sub ? el('div', { style: 'color:#333;' }, sub) : null,
      bullets(detail),
    );

  const contact = [cv.email, cv.phone, cv.address, ...cv.links.split('\n')].map((x) => x.trim()).filter(Boolean);
  const edu = cv.education.filter(filled);
  const exp = cv.experience.filter(filled);
  const refs = cv.referees.filter(filled);
  const skills = cv.skills.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

  const kids: (Node | null)[] = [
    el('h2', { style: `margin:0;font-size:24px;font-weight:800;color:${accent};` }, cv.name.trim() || 'Your name'),
    cv.headline.trim() ? el('div', { style: 'font-size:14px;margin-top:2px;' }, cv.headline.trim()) : null,
    contact.length ? el('div', { style: 'margin-top:4px;color:#333;' }, contact.join('  |  ')) : null,
    cv.summary.trim() ? h('Profile') : null,
    cv.summary.trim() ? el('p', { style: 'margin:2px 0;' }, cv.summary.trim()) : null,
    edu.length ? h('Education') : null,
    ...edu.map((r) => entry(r.school.trim() || 'Institution', r.course.trim(), r.dates.trim(), r.detail)),
    exp.length ? h('Experience') : null,
    ...exp.map((r) => entry(r.role.trim() || 'Role', r.org.trim(), r.dates.trim(), r.detail)),
    skills.length ? h('Skills') : null,
    skills.length ? el('p', { style: 'margin:2px 0;' }, skills.join(', ')) : null,
    refs.length || cv.refereesOnRequest ? h('Referees') : null,
    ...refs.map((r) => el('div', { style: 'margin:4px 0;break-inside:avoid;' }, el('strong', {}, r.name.trim() || 'Referee'), r.role.trim() ? el('div', {}, r.role.trim()) : null, r.contact.trim() ? el('div', { style: 'color:#333;' }, r.contact.trim()) : null)),
    !refs.length && cv.refereesOnRequest ? el('p', { style: 'margin:2px 0;' }, 'Available on request.') : null,
  ];
  preview.replaceChildren(...(kids.filter(Boolean) as Node[]));
}

function save() {
  if (!saveJSON(KEY, cv)) {
    $('#cv-save-note').textContent = 'Could not save on this device (private mode?). Print or save as PDF before you leave.';
  }
}

function changed() {
  render();
  window.clearTimeout(timer);
  timer = window.setTimeout(save, 400);
}

// Save straight away if the page is closed or hidden before the short delay ends.
let cleared = false;
function flush() {
  if (cleared) return;
  window.clearTimeout(timer);
  save();
}
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

const simple: (keyof CV)[] = ['name', 'headline', 'email', 'phone', 'address', 'links', 'summary', 'skills'];
for (const key of simple) {
  const input = $(`#cv-${key}`) as HTMLInputElement | HTMLTextAreaElement;
  input.value = cv[key] as string;
  input.addEventListener('input', () => {
    (cv[key] as string) = input.value;
    changed();
  });
}

const onReq = $('#cv-onrequest') as HTMLInputElement;
onReq.checked = cv.refereesOnRequest;
onReq.addEventListener('change', () => {
  cv.refereesOnRequest = onReq.checked;
  changed();
});
const accentSel = $('#cv-accent') as HTMLSelectElement;
accentSel.value = cv.accent;
accentSel.addEventListener('change', () => {
  cv.accent = accentSel.value === 'black' ? 'black' : 'blue';
  changed();
});

const edu = groupEditor($('#cv-edu'), 'Education', [
  { key: 'school', label: 'School', wide: true, placeholder: 'University of Benin' },
  { key: 'course', label: 'Course and award', placeholder: 'B.Sc. Computer Science' },
  { key: 'dates', label: 'Dates', placeholder: '2022 to date' },
  { key: 'detail', label: 'Details (one point per line)', type: 'textarea', placeholder: 'Current CGPA: 4.32 / 5.0' },
], cv.education, changed, blankEdu);
const exp = groupEditor($('#cv-exp'), 'Experience', [
  { key: 'role', label: 'Role', placeholder: 'SIWES Intern' },
  { key: 'org', label: 'Organisation', placeholder: 'Company, city' },
  { key: 'dates', label: 'Dates', wide: true, placeholder: 'Mar to Aug 2025' },
  { key: 'detail', label: 'What you did (one point per line)', type: 'textarea', placeholder: 'Built and tested a booking form used by 200 customers' },
], cv.experience, changed, blankExp);
const refs = groupEditor($('#cv-refs'), 'Referee', [
  { key: 'name', label: 'Name', placeholder: 'Dr A. Bello' },
  { key: 'role', label: 'Position', placeholder: 'Head of Department' },
  { key: 'contact', label: 'Phone or email', wide: true },
], cv.referees, changed, blankRef);

$('#cv-add-edu').addEventListener('click', edu.add);
$('#cv-add-exp').addEventListener('click', exp.add);
$('#cv-add-ref').addEventListener('click', refs.add);
$('#cv-print').addEventListener('click', () => window.print());
$('#cv-clear').addEventListener('click', () => {
  if (!window.confirm('Clear your whole CV from this device? This cannot be undone.')) return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
  cleared = true;
  window.clearTimeout(timer);
  location.reload();
});

render();
