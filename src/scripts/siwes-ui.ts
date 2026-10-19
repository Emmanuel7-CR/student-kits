import { $, copyText, el, loadJSON, saveJSON } from './dom';
import { logbookWeeks, shortDate, weekdayName } from '../lib/siwes';

const KEY = 'fsk:siwes:v1';
const IDS = ['name', 'matric', 'dept', 'school', 'level', 'company', 'caddress', 'supervisor', 'start', 'weeks', 'days', 'recipient', 'duration', 'phone', 'email'] as const;
type Id = (typeof IDS)[number];
type Data = Record<Id, string>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const saved = loadJSON<Record<string, unknown>>(KEY, {}, isObj);
const data = Object.fromEntries(IDS.map((k) => [k, typeof saved[k] === 'string' ? (saved[k] as string) : ''])) as Data;
if (!data.weeks) data.weeks = '24';
if (!data.days) data.days = '5';
if (!data.recipient) data.recipient = 'The Human Resources Manager';

const input = (id: Id) => $(`#si-${id}`) as HTMLInputElement | HTMLSelectElement;
let timer: number | undefined;

const page = (...kids: (Node | null)[]) => el('div', { class: 'siwes-page', style: 'break-after:page;page-break-after:always;padding:4px 2px 18px;' }, ...(kids.filter(Boolean) as Node[]));
const line = (label: string, value: string) =>
  el('div', { style: 'margin:2px 0;' }, el('strong', {}, label + ': '), value.trim() || '______________________________');

/* ---------- Logbook ---------- */
function renderLogbook() {
  const root = $('#si-logbook');
  const weeksN = Number(data.weeks);
  const days = data.days === '6' ? 6 : 5;
  const weeks = data.start ? logbookWeeks(data.start, weeksN, days) : null;
  $('#si-count').textContent = weeks ? `${weeks.length} weekly pages, from ${shortDate(weeks[0].from)} to ${shortDate(weeks[weeks.length - 1].to)}.` : 'Choose a start date and the number of weeks (1 to 52).';
  $('#si-print-log').toggleAttribute('disabled', !weeks);
  if (!weeks) {
    root.replaceChildren(el('p', { class: 'text-muted' }, 'Your logbook pages will show here.'));
    return;
  }

  const header = () =>
    el(
      'div',
      { style: 'border-bottom:2px solid #1f4f86;padding-bottom:6px;margin-bottom:8px;' },
      el('div', { style: 'font-size:16px;font-weight:800;color:#1f4f86;' }, 'STUDENTS INDUSTRIAL WORK EXPERIENCE SCHEME (SIWES) WEEKLY RECORD'),
      line('Name', data.name),
      line('Matric number', data.matric),
      line('Department / Institution', [data.dept, data.school].filter((x) => x.trim()).join(', ')),
      line('Place of attachment', [data.company, data.caddress].filter((x) => x.trim()).join(', ')),
    );

  const cover = page(
    el('div', { style: 'text-align:center;padding-top:60px;' },
      el('div', { style: 'font-size:20px;font-weight:800;color:#1f4f86;' }, 'SIWES LOGBOOK'),
      el('div', { style: 'margin-top:28px;text-align:left;font-size:14px;line-height:2;max-width:420px;margin-inline:auto;' },
        line('Name', data.name), line('Matric number', data.matric), line('Department', data.dept), line('Institution', data.school), line('Level', data.level),
        line('Place of attachment', data.company), line('Address', data.caddress), line('Industry-based supervisor', data.supervisor),
        line('Period', `${shortDate(weeks[0].from)} to ${shortDate(weeks[weeks.length - 1].to)}`),
      ),
    ),
  );

  const weekPages = weeks.map((w) =>
    page(
      header(),
      el('div', { style: 'font-size:14px;font-weight:700;margin:4px 0 6px;' }, `Week ${w.week}: ${shortDate(w.from)} to ${shortDate(w.to)}`),
      el(
        'table',
        { style: 'width:100%;border-collapse:collapse;font-size:12px;' },
        el('thead', {}, el('tr', {}, ...['Day and date', 'Activities carried out'].map((t, i) => el('th', { style: `border:1px solid #444;padding:5px;text-align:left;background:#eaf2fb;${i === 0 ? 'width:22%;' : ''}` }, t)))),
        el('tbody', {}, ...w.days.map((d) => el('tr', {}, el('td', { style: 'border:1px solid #444;padding:5px;vertical-align:top;height:78px;' }, `${weekdayName(d)}, ${shortDate(d)}`), el('td', { style: 'border:1px solid #444;padding:5px;' })))),
      ),
      el('div', { style: 'margin-top:14px;font-size:12px;' },
        el('div', { style: 'margin:10px 0;' }, 'Student signature: ____________________   Date: ____________'),
        el('div', { style: 'margin:10px 0;' }, "Industry-based supervisor's comment: ______________________________________"),
        el('div', { style: 'margin:10px 0;' }, '____________________________________________________________'),
        el('div', { style: 'margin:10px 0;' }, 'Supervisor signature and stamp: ____________________   Date: ____________'),
      ),
    ),
  );
  root.replaceChildren(cover, ...weekPages);
}

/* ---------- Letter ---------- */
function letterLines(): string[] {
  const dur = data.duration.trim();
  const when = data.start ? ` starting around ${shortDate(data.start)}` : '';
  const who = data.name.trim() || '[Your name]';
  const course = data.dept.trim() || '[your department]';
  const school = data.school.trim() || '[your institution]';
  const level = data.level.trim();
  const company = data.company.trim() || '[Company name]';
  return [
    data.name.trim() || '[Your name]',
    ...[data.phone.trim(), data.email.trim()].filter(Boolean),
    '',
    new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    '',
    data.recipient.trim() || 'The Human Resources Manager',
    company,
    ...(data.caddress.trim() ? [data.caddress.trim()] : []),
    '',
    'Dear Sir or Madam,',
    '',
    'APPLICATION FOR STUDENTS INDUSTRIAL WORK EXPERIENCE SCHEME (SIWES) PLACEMENT',
    '',
    `I am ${who}, a${level ? ` ${level}` : ''} student of the Department of ${course}, ${school}. I am writing to apply for a SIWES placement at ${company}${dur ? ` for ${dur}` : ''}${when}.`,
    '',
    'The scheme is a compulsory part of my programme, and I would like to gain practical experience in an organisation whose work matches what I am studying. I am willing to learn, to follow instructions, and to keep to the rules and working hours of your organisation.',
    '',
    'I have attached my CV and the SIWES introduction letter from my department. I would be grateful for the chance to meet you or any member of your team, and I can be reached on the details above.',
    '',
    'Thank you for your time and consideration.',
    '',
    'Yours faithfully,',
    '',
    '',
    who,
  ];
}

function renderLetter() {
  const lines = letterLines();
  const root = $('#si-letter');
  root.replaceChildren(...lines.map((l) => (l === '' ? el('div', { style: 'height:10px;' }) : el('p', { style: 'margin:0;' + (l.startsWith('APPLICATION') ? 'font-weight:700;' : '') }, l))));
  (root as HTMLElement & { _plain?: string })._plain = lines.join('\n');
}

function renderAll() {
  renderLogbook();
  renderLetter();
}

function persist() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => saveJSON(KEY, data), 400);
}
// Save straight away if the page is closed or hidden before the short delay ends.
let cleared = false;
function flush() {
  if (cleared) return;
  window.clearTimeout(timer);
  saveJSON(KEY, data);
}
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

for (const id of IDS) {
  const f = input(id);
  f.value = data[id];
  f.addEventListener('input', () => {
    data[id] = f.value;
    renderAll();
    persist();
  });
  f.addEventListener('change', () => {
    data[id] = f.value;
    renderAll();
    persist();
  });
}

/* ---------- tabs and actions ---------- */
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')];
const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
function show(name: string) {
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  panels.forEach((p) => (p.hidden = p.dataset.panel !== name));
  document.body.dataset.printing = name;
}
tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab!)));
show('logbook');

$('#si-print-log').addEventListener('click', () => {
  show('logbook');
  window.print();
});
$('#si-print-letter').addEventListener('click', () => {
  show('letter');
  window.print();
});
$('#si-copy-letter').addEventListener('click', async () => {
  const plain = ($('#si-letter') as HTMLElement & { _plain?: string })._plain ?? '';
  const ok = await copyText(plain);
  const label = $('#si-copy-letter').querySelector('span')!;
  label.textContent = ok ? 'Copied' : 'Copy not available here';
  setTimeout(() => (label.textContent = 'Copy letter text'), 2000);
});
$('#si-clear').addEventListener('click', () => {
  if (!window.confirm('Clear all the details you typed from this device?')) return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
  cleared = true;
  window.clearTimeout(timer);
  location.reload();
});

renderAll();
